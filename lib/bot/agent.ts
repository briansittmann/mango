/**
 * Agent mode for VIP accounts (`bot-conversation` → *A VIP account's open question is answered with
 * the account's figures*, `add-bot-agent-mode`): a function-calling loop over the MCP's read tools.
 * Pure module like `parser.ts`: the model call and the tools are injected, so `agent.test.mjs` and
 * `agent.eval.mjs` load it from plain Node. It knows nothing about WhatsApp, Supabase or Gemini.
 */

/** A tool the model may call: the MCP tool's name and description, its JSON Schema, and a runner that never throws. */
export type AgentTool = {
  name: string
  description: string
  /** JSON Schema of the arguments, as Gemini's `parametersJsonSchema` takes it. */
  parameters: Record<string, unknown>
  /** Runs the tool and returns what the model reads: the result, or an error object. */
  run(args: Record<string, unknown>): Promise<Record<string, unknown>>
}

export type FunctionCall = { name: string; args?: Record<string, unknown>; id?: string }

export type AgentPart =
  | { text: string }
  | { functionCall: FunctionCall }
  | { functionResponse: { name: string; response: Record<string, unknown>; id?: string } }

export type AgentContent = { role: 'user' | 'model'; parts: AgentPart[] }

export type AgentRequest = {
  system: string
  contents: AgentContent[]
  /** Undefined on the last step: the model must answer with what it read. */
  tools: AgentTool[] | undefined
  /** Aborts when the whole turn's budget is spent. */
  signal: AbortSignal
}

/** One model call. `content` is the model's turn as it must be echoed back before the tool results. */
export type AgentResponse = { text: string; functionCalls: FunctionCall[]; content?: AgentContent }
export type AgentCall = (request: AgentRequest) => Promise<AgentResponse>

export type AgentInput = {
  system: string
  /** The VIP history, oldest first (`bot-conversation-history`): previous turns of the same chat. */
  history: { direction: 'entrante' | 'saliente'; text: string }[]
  message: string
  tools: AgentTool[]
  call: AgentCall
  now?: () => number
}

export type AgentResult =
  | { kind: 'answered'; text: string; toolCalls: string[] }
  /** The model never answered: two calls failed in a row, or the budget ran out. */
  | { kind: 'unavailable' }

/** Model calls per turn; the last one runs without tools, so it has to answer with what it read. */
export const MAX_AGENT_STEPS = 4

/**
 * The whole turn's budget. The webhook has 60 s (`maxDuration`), the parser already spent one call
 * before the agent starts, and the reply still has to be sent.
 */
export const AGENT_TIMEOUT_MS = 30_000

/**
 * Runs the loop: history and message as contents, then up to `MAX_AGENT_STEPS` model calls. A
 * response with function calls runs every tool (in parallel), appends the model's turn and the
 * results, and calls again; a response with text is the answer. A call that throws is retried
 * once with the same contents; a second failure in a row (a throw or an empty answer), or the
 * budget spent, is `unavailable`.
 */
export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const now = input.now ?? Date.now
  const deadline = now() + AGENT_TIMEOUT_MS
  const byName = new Map(input.tools.map((tool) => [tool.name, tool]))
  const contents: AgentContent[] = [
    ...input.history.map((message): AgentContent => ({ role: message.direction === 'entrante' ? 'user' : 'model', parts: [{ text: message.text }] })),
    { role: 'user', parts: [{ text: input.message }] },
  ]
  const toolCalls: string[] = []
  let failures = 0

  for (let step = 0; step < MAX_AGENT_STEPS; ) {
    const remaining = deadline - now()
    if (remaining <= 0) return { kind: 'unavailable' }
    const last = step === MAX_AGENT_STEPS - 1

    let response: AgentResponse
    try {
      response = await input.call({ system: input.system, contents, tools: last ? undefined : input.tools, signal: AbortSignal.timeout(remaining) })
    } catch (error) {
      console.warn(`[agent] model call failed (step ${step + 1}):`, error)
      if (++failures >= 2) return { kind: 'unavailable' }
      continue
    }

    if (response.functionCalls.length === 0 || last) {
      const text = response.text.trim()
      if (text) return { kind: 'answered', text, toolCalls }
      // Neither text nor a call: one more try, counted like a failed call.
      if (++failures >= 2) return { kind: 'unavailable' }
      continue
    }

    contents.push(response.content ?? { role: 'model', parts: response.functionCalls.map((functionCall) => ({ functionCall })) })
    const results = await Promise.all(
      response.functionCalls.map(async (call) => {
        toolCalls.push(call.name)
        const tool = byName.get(call.name)
        const response = tool
          ? await tool.run(call.args ?? {})
          : { code: 'unknown-tool', message: `No tool is named ${call.name}. The tools are: ${[...byName.keys()].join(', ')}.` }
        return { functionResponse: { name: call.name, response, ...(call.id ? { id: call.id } : {}) } }
      }),
    )
    contents.push({ role: 'user', parts: results })
    failures = 0
    step++
  }

  return { kind: 'unavailable' }
}

export type AgentPromptInput = {
  locale: 'es' | 'en'
  /** Today's local date, `YYYY-MM-DD`, and the account's time zone. */
  today: string
  timezone: string
  currency: string
  /** Two amounts written as the bot writes them ("1.234,56 € o 300 €"): thousands, decimals and a whole one, so the model copies the format. */
  amountExample: string
  categories: string[]
  /** The cycle rules the MCP server gives its clients (`MCP_INSTRUCTIONS`). */
  cycleRules: string
  /** The dashboard's URL. */
  link: string
  /** The MCP server's URL, the one the account sheet shows for Claude and ChatGPT. */
  mcpUrl: string
}

/** The system prompt (design D5): who it is, the account, the cycle rules, how to use the tools and how to answer. */
export function buildAgentPrompt(input: AgentPromptInput): string {
  const language = input.locale === 'en' ? 'inglés' : 'español rioplatense, con voseo ("tenés", "llevás", "gastaste")'
  return `Sos Mango, el bot de finanzas personales que esta persona usa por WhatsApp. Respondés preguntas sobre su plata con sus propios datos, que leés con las herramientas. Solo leés: nunca anotás, corregís ni borrás nada.

DATOS DE LA CUENTA
Hoy es ${input.today} (zona horaria ${input.timezone}). Moneda: ${input.currency}; los montos se escriben así: ${input.amountExample}.
Idioma de la cuenta: ${language}. Respondé siempre en ese idioma.
Categorías: ${input.categories.join(', ')}

CICLOS
${input.cycleRules}

HERRAMIENTAS
- Toda cifra que digas tiene que venir de una herramienta llamada en este turno. Nunca inventes, estimes ni recuerdes una cifra: si no la leíste, leela antes de responder. Las cuentas que hagas (una resta, una suma) solo con cifras leídas.
- Cómo viene, una categoría, un presupuesto, el margen libre, el ahorro, las tarjetas → get_summary. Movimientos concretos ("cuánto gasté en Netflix", "qué cargué ayer", "mi gasto más grande") → list_movements. Gastos fijos, suscripciones, cuotas, lo que se cobra tal día → list_fixed_charges. Un período anterior o futuro → la misma herramienta con "month".
- Un saludo, un agradecimiento o una pregunta sobre qué sabés hacer no necesita herramientas.
- Si una herramienta devuelve un error, decí que no pudiste leer ese dato; no inventes el resultado.

RESPUESTA
- Texto plano de WhatsApp: sin markdown, sin títulos, sin tablas ni viñetas con guión. Negrita solo para la cifra clave y con un solo asterisco de cada lado (*150 €*), nunca dos ni tres. Corto: de 1 a 6 líneas, una idea por línea. Empezá con un emoji que acompañe (📊 💸 🐷 💳 👋 🤔).
- Los montos siempre con el formato de la cuenta (${input.amountExample}): mismo separador de miles y de decimales, el símbolo de la moneda, y sin decimales cuando el monto es entero.
- Si preguntan por una categoría con presupuesto, decí lo gastado, el presupuesto y lo que queda (o lo que se pasó).
- Podés sugerir algo concreto sobre sus gastos, presupuestos y ahorro con sus números. Nunca consejos de inversión ni productos financieros.
- Nunca te quedes sin respuesta ni contestes solo "no puedo". Si algo no lo podés hacer desde acá, decilo relajado ("eso todavía no lo puedo hacer desde el chat") y dale opciones concretas, en este orden y solo las que sirvan: lo que sí puede hacer por el chat, la web, y Claude o ChatGPT con Mango conectado.
- Si no se entiende a qué se refiere, preguntalo en una línea, con un par de ejemplos de lo que podés hacer.
- El detalle completo está en ${input.link}; nombralo solo cuando sume.

LO QUE SE HACE POR EL CHAT (no lo hacés vos: se lo explicás)
- Anotar gastos, ingresos y ahorro escribiéndolos ("súper 30", "cobré 2100", "ahorré 200"), también varios en un mensaje ("café 3, súper 25 y nafta 40") o por nota de voz.
- Corregir o borrar la última carga: «no, era 40», «eran comida», «borrá eso», «la nafta era 45».
- Crear una categoría: «creá la categoría Regalos con presupuesto 150».
- "¿Cómo vengo?" y "libre" dan el resumen del mes y el margen libre.

CLAUDE Y CHATGPT (el MCP de Mango)
Mango se conecta a Claude y a ChatGPT, y desde ahí la persona maneja su cuenta hablando. Ofrecelo solo cuando piden algo que el chat no hace y eso sí; no lo nombres en cada respuesta.
- Lo que hace y el chat no: borrar, renombrar o reordenar categorías; cambiar un presupuesto (solo este mes o desde este mes); crear, editar, borrar o marcar como cobrado un gasto fijo; crear y editar tarjetas y asignarles fijos; editar o borrar cualquier movimiento, no solo la última carga; y analizar meses con más detalle. Todo eso también se hace en la web.
- Lo que no hace: cambiar la cuenta (nombre, moneda, día de inicio del ciclo, idioma) ni vincular WhatsApp; eso es solo en la web.
- Si preguntan cómo conectarlo, dales estos pasos tal cual:
  Dirección: ${input.mcpUrl}
  En Claude: Configuración → Conectores → Añadir conector personalizado, y pegás la dirección.
  En ChatGPT: Configuración → Apps y conectores → Crear, y pegás la dirección.
  Después te pide entrar con tu cuenta de Mango y dar permiso. Las conexiones se ven y se desconectan desde Cuenta, en la web.`
}

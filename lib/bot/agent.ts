/**
 * Agent mode for VIP accounts (`bot-conversation` → *A VIP account's open question is answered with
 * the account's figures*, `add-bot-agent-mode`; writes with confirmation, `add-bot-agent-writes`):
 * a function-calling loop over the MCP's tools. Pure module like `parser.ts`: the model call and
 * the tools are injected, so `agent.test.mjs` and `agent.eval.mjs` load it from plain Node. It
 * knows nothing about WhatsApp, Supabase or Gemini.
 */

/** A tool the model may call: the MCP tool's name and description, its JSON Schema, and a runner that never throws. */
export type AgentTool = {
  name: string
  description: string
  /** JSON Schema of the arguments, as Gemini's `parametersJsonSchema` takes it. */
  parameters: Record<string, unknown>
  /**
   * A write (`add-bot-agent-writes` D2): the loop never runs it. The call comes back as the
   * `confirm` result, for the person to approve, and `run` is called only then.
   */
  confirm?: boolean
  /** Runs the tool and returns what the model reads: the result, or an error object. */
  run(args: Record<string, unknown>): Promise<Record<string, unknown>>
}

/** A write the model asked for and the person has not approved yet: the tool and its arguments as given. */
export type PlannedCall = { name: string; args: Record<string, unknown> }

/** What a write call gets instead of running: the model has to ask first. */
const NEEDS_CONFIRMATION = {
  code: 'needs-confirmation',
  message: 'Not run yet. Reply with a question of one or two lines naming exactly what will change; the person confirms with a button and the call runs then.',
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
  /** The turn's budget in ms, `AGENT_TIMEOUT_MS` by default; the bot passes what is left of the webhook's time. */
  budgetMs?: number
  now?: () => number
}

export type AgentResult =
  | { kind: 'answered'; text: string; toolCalls: string[] }
  /** The model wants to write: `text` is its question, `calls` the writes it asked for (not run), `toolCalls` what it read. */
  | { kind: 'confirm'; text: string; calls: PlannedCall[]; toolCalls: string[] }
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
 * response with function calls runs every read tool (in parallel), appends the model's turn and the
 * results, and calls again; a response with text is the answer. A call that throws is retried
 * once with the same contents; a second failure in a row (a throw or an empty answer), or the
 * budget spent, is `unavailable`.
 *
 * A write (`confirm` tool, `add-bot-agent-writes` D2) is not run: it gets `needs-confirmation`, the
 * next call runs without tools, and its text is the question the person answers with a button.
 * That result is `confirm`, with every write of that response in order.
 */
export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const now = input.now ?? Date.now
  const deadline = now() + (input.budgetMs ?? AGENT_TIMEOUT_MS)
  const byName = new Map(input.tools.map((tool) => [tool.name, tool]))
  const contents: AgentContent[] = [
    ...input.history.map((message): AgentContent => ({ role: message.direction === 'entrante' ? 'user' : 'model', parts: [{ text: message.text }] })),
    { role: 'user', parts: [{ text: input.message }] },
  ]
  const toolCalls: string[] = []
  let planned: PlannedCall[] | null = null
  let failures = 0

  for (let step = 0; step < MAX_AGENT_STEPS; ) {
    const remaining = deadline - now()
    if (remaining <= 0) return { kind: 'unavailable' }
    const last = step === MAX_AGENT_STEPS - 1 || planned !== null

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
      if (text) return planned ? { kind: 'confirm', text, calls: planned, toolCalls } : { kind: 'answered', text, toolCalls }
      // Neither text nor a call: one more try, counted like a failed call.
      if (++failures >= 2) return { kind: 'unavailable' }
      continue
    }

    contents.push(response.content ?? { role: 'model', parts: response.functionCalls.map((functionCall) => ({ functionCall })) })
    const writes: PlannedCall[] = []
    const results = await Promise.all(
      response.functionCalls.map(async (call) => {
        const tool = byName.get(call.name)
        const args = call.args ?? {}
        let response: Record<string, unknown>
        if (!tool) {
          response = { code: 'unknown-tool', message: `No tool is named ${call.name}. The tools are: ${[...byName.keys()].join(', ')}.` }
        } else if (tool.confirm) {
          writes.push({ name: call.name, args })
          response = NEEDS_CONFIRMATION
        } else {
          toolCalls.push(call.name)
          response = await tool.run(args)
        }
        return { functionResponse: { name: call.name, response, ...(call.id ? { id: call.id } : {}) } }
      }),
    )
    contents.push({ role: 'user', parts: results })
    if (writes.length > 0) planned = writes
    failures = 0
    step++
  }

  return { kind: 'unavailable' }
}

export type NarrateInput = {
  system: string
  history: AgentInput['history']
  /** The writes the person approved, each with what its tool returned (a result, or an error object with `code`). */
  results: { name: string; args: Record<string, unknown>; response: Record<string, unknown> }[]
  call: AgentCall
  budgetMs?: number
  now?: () => number
}

/**
 * After the person approved and the writes ran (`add-bot-agent-writes` D2): one model call without
 * tools, with the history and the results, so the reply says what was done in the bot's voice.
 * A failed call is retried once; null when the model never answered, and the caller falls back
 * to a fixed text, because the writes already happened and must never go unanswered.
 */
export async function narrateResults(input: NarrateInput): Promise<string | null> {
  const now = input.now ?? Date.now
  const deadline = now() + (input.budgetMs ?? AGENT_TIMEOUT_MS)
  const lines = input.results.map((result) => `${result.name} ${JSON.stringify(result.args)} → ${JSON.stringify(result.response)}`)
  const contents: AgentContent[] = [
    ...input.history.map((message): AgentContent => ({ role: message.direction === 'entrante' ? 'user' : 'model', parts: [{ text: message.text }] })),
    {
      role: 'user',
      parts: [
        {
          text: `La persona tocó «Sí» y las herramientas ya corrieron. Resultados:\n${lines.join('\n')}\n\nContá en 1 a 3 líneas qué quedó hecho, con las cifras de los resultados. Si un resultado trae "code", eso no se pudo hacer: decilo. Sin preguntas.`,
        },
      ],
    },
  ]

  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - now()
    if (remaining <= 0) return null
    try {
      const response = await input.call({ system: input.system, contents, tools: undefined, signal: AbortSignal.timeout(remaining) })
      const text = response.text.trim()
      if (text) return text
    } catch (error) {
      console.warn(`[agent] narration failed (attempt ${attempt + 1}):`, error)
    }
  }
  return null
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

/** The system prompt (design D5; writes in `add-bot-agent-writes` D4): who it is, the account, the cycle rules, how to read, how to write with confirmation and how to answer. */
export function buildAgentPrompt(input: AgentPromptInput): string {
  const language = input.locale === 'en' ? 'inglés' : 'español rioplatense, con voseo ("tenés", "llevás", "gastaste")'
  return `Sos Mango, el bot de finanzas personales que esta persona usa por WhatsApp. Respondés preguntas sobre su plata y hacés cambios en su cuenta con sus propios datos, que leés y escribís con las herramientas. Nunca escribís sin que la persona confirme.

DATOS DE LA CUENTA
Hoy es ${input.today} (zona horaria ${input.timezone}). Moneda: ${input.currency}; los montos se escriben así: ${input.amountExample}.
Idioma de la cuenta: ${language}. Respondé siempre en ese idioma.
Categorías: ${input.categories.join(', ')}

CICLOS
${input.cycleRules}

LEER
- Toda cifra que digas tiene que venir de una herramienta llamada en este turno. Nunca inventes, estimes ni recuerdes una cifra: si no la leíste, leela antes de responder. Las cuentas que hagas (una resta, una suma) solo con cifras leídas.
- Cómo viene, una categoría, un presupuesto, el margen libre, el ahorro, las tarjetas → get_summary. Movimientos concretos ("cuánto gasté en Netflix", "qué cargué ayer", "mi gasto más grande") → list_movements. Gastos fijos, suscripciones, cuotas, lo que se cobra tal día → list_fixed_charges. Un período anterior o futuro → la misma herramienta con "month".
- Un saludo, un agradecimiento o una pregunta sobre qué sabés hacer no necesita herramientas.
- Si una herramienta devuelve un error, decí que no pudiste leer o hacer eso; no inventes el resultado.

ESCRIBIR (anotar, corregir, borrar, cambiar)
- Una herramienta que escribe no corre: devuelve needs-confirmation. Entonces respondé solo con la pregunta, en una o dos líneas, nombrando exactamente qué va a cambiar: de un movimiento, descripción, monto y día; de una categoría, nombre y qué cambia (el presupuesto nuevo o "sin presupuesto", y si es solo este mes o desde este mes); de un fijo, nombre y qué cambia. Sin ✅ ni "listo": todavía no pasó nada. La persona confirma con botones.
- Antes de escribir, leé: el id de un movimiento sale de list_movements, el de una categoría de get_summary, el de un fijo de list_fixed_charges. Nunca inventes ni recuerdes un id.
- Varias órdenes en un mensaje → llamá todas las herramientas de escritura en la misma respuesta, así una sola pregunta las nombra todas.
- Si no está claro qué cambiar (dos movimientos con el mismo monto, una categoría que no existe, un cambio de presupuesto en el ciclo en curso sin decir si es solo este mes o de acá en adelante), preguntalo en texto antes de llamar a una herramienta de escritura, nombrando las opciones que leíste.
- Alcance: "este mes", "por este mes", "solo ahora" → only_this_month; "de ahora en más", "siempre", "desde este mes" → from_this_month. "Sin límite", "sin tope", "sacá el presupuesto" → budget null.
- Un gasto, ingreso o ahorro de hoy se anota escribiéndolo («súper 30», «cobré 2100»): decíselo así, sin herramienta. Usá add_movement solo cuando no entra por ahí: otra fecha u otro mes.
- Cuando te digan que la persona confirmó y veas los resultados, contá en 1 a 3 líneas qué quedó hecho, con cifras de los resultados; si algo falló, decilo y ofrecé la web.

RESPUESTA
- Texto plano de WhatsApp: sin markdown, sin títulos, sin tablas ni viñetas con guión. Negrita solo para la cifra clave y con un solo asterisco de cada lado (*150 €*), nunca dos ni tres. Corto: de 1 a 6 líneas, una idea por línea. Empezá con un emoji que acompañe (📊 💸 🐷 💳 👋 🤔).
- Los montos siempre con el formato de la cuenta (${input.amountExample}): mismo separador de miles y de decimales, el símbolo de la moneda, y sin decimales cuando el monto es entero.
- Si preguntan por una categoría con presupuesto, decí lo gastado, el presupuesto y lo que queda (o lo que se pasó).
- Podés sugerir algo concreto sobre sus gastos, presupuestos y ahorro con sus números. Nunca consejos de inversión ni productos financieros.
- Nunca te quedes sin respuesta ni contestes solo "no puedo". Lo que no se hace desde acá (cambiar la cuenta: nombre, moneda, día de inicio del ciclo, idioma; vincular WhatsApp) decilo relajado ("eso todavía no lo puedo hacer desde el chat") y mandá a la web.
- Si no se entiende a qué se refiere, preguntalo en una línea, con un par de ejemplos de lo que podés hacer.
- El detalle completo está en ${input.link}; nombralo solo cuando sume.

LO QUE SE HACE POR EL CHAT SIN VOS (se lo explicás)
- Anotar gastos, ingresos y ahorro escribiéndolos ("súper 30", "cobré 2100", "ahorré 200"), también varios en un mensaje ("café 3, súper 25 y nafta 40") o por nota de voz.
- Corregir o borrar la última carga: «no, era 40», «eran comida», «borrá eso», «la nafta era 45».
- Crear una categoría: «creá la categoría Regalos con presupuesto 150».
- "¿Cómo vengo?" y "libre" dan el resumen del mes y el margen libre.
Todo lo demás (borrar o cambiar cualquier movimiento, presupuestos, categorías, fijos, tarjetas) lo hacés vos con las herramientas, con confirmación.

CLAUDE Y CHATGPT (el MCP de Mango)
Mango también se conecta a Claude y a ChatGPT, con estas mismas herramientas. Nombralo solo si preguntan por eso o quieren analizar su plata largo y tendido; no en cada respuesta.
- Si preguntan cómo conectarlo, dales estos pasos tal cual:
  Dirección: ${input.mcpUrl}
  En Claude: Configuración → Conectores → Añadir conector personalizado, y pegás la dirección.
  En ChatGPT: Configuración → Apps y conectores → Crear, y pegás la dirección.
  Después te pide entrar con tu cuenta de Mango y dar permiso. Las conexiones se ven y se desconectan desde Cuenta, en la web.`
}

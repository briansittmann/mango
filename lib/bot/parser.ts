/**
 * Chat message → one validated action (`bot-message-parsing`, design D1–D3). Pure module: the
 * model call is injected and only relative imports are used, so `parser.eval.mjs` and the unit
 * tests load it from plain Node without Next.
 */

import { z } from 'zod'

const tipo = z.enum(['gasto', 'ingreso', 'ahorro'])
const diasAtras = z.number().int().min(0).default(0)

const CargarSchema = z
  .strictObject({
    accion: z.literal('cargar'),
    tipo,
    monto: z.number(),
    categoria: z.string().min(1).nullable().default(null),
    descripcion: z.string().min(1).nullable().default(null),
    dias_atras: diasAtras,
    recurrente: z.string().min(1).nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.tipo === 'ahorro' ? value.monto === 0 : value.monto <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['monto'],
        message: value.tipo === 'ahorro' ? 'ahorro needs a non-zero monto' : `${value.tipo} needs a positive monto`,
      })
    }
  })

export const ActionSchema = z.discriminatedUnion('accion', [
  CargarSchema,
  z.strictObject({
    accion: z.literal('repreguntar'),
    falta: z.literal('categoria'),
    tipo,
    monto: z.number().positive(),
    dias_atras: diasAtras,
  }),
  z.strictObject({ accion: z.literal('no_entendido') }),
  z.strictObject({ accion: z.literal('consultar'), consulta: z.enum(['margen_libre', 'mes']) }),
  z
    .strictObject({
      accion: z.literal('corregir'),
      monto: z.number().positive().optional(),
      categoria: z.string().min(1).optional(),
    })
    .refine((value) => value.monto !== undefined || value.categoria !== undefined, {
      message: 'corregir needs monto or categoria',
    }),
  z.strictObject({ accion: z.literal('borrar') }),
  z.strictObject({
    accion: z.literal('crear_categoria'),
    nombre: z.string().min(1),
    presupuesto: z.number().positive().optional(),
    confirmada: z.boolean().default(false),
  }),
])

export type Action = z.infer<typeof ActionSchema>

/** An action, or `no_disponible` when the model never answered (not something the model can return). */
export type ParseResult = Action | { accion: 'no_disponible' }

/**
 * The question the channel holds (design D5): a category for an amount, or whether to create a
 * category whose name is close to `parecida`.
 */
export type PendingQuestion =
  | { pregunta: 'categoria'; tipo: 'gasto' | 'ingreso' | 'ahorro'; monto: number; diasAtras: number }
  | { pregunta: 'crear_categoria'; nombre: string; presupuesto: number | null; parecida: string }

export type ParseInput = {
  text: string
  /** Account categories, verbatim from the database. */
  categories: string[]
  /** Names of the account's active `gasto` recurring definitions. */
  recurringNames: string[]
  locale: 'es' | 'en'
  /** Today's local date, `YYYY-MM-DD`. */
  today: string
  pending?: PendingQuestion
  /** A VIP account's recent messages, oldest first (`bot-conversation-history`). */
  history?: { direction: 'entrante' | 'saliente'; text: string }[]
}

export type Model = (prompt: string) => Promise<string>

const EXAMPLES: Record<ParseInput['locale'], [string, object][]> = {
  es: [
    ['nafta 45 ayer', { accion: 'cargar', tipo: 'gasto', monto: 45, categoria: 'Transporte', descripcion: 'Nafta', dias_atras: 1, recurrente: null }],
    ['cafe 3,5.', { accion: 'cargar', tipo: 'gasto', monto: 3.5, categoria: 'Ocio', descripcion: 'Café', dias_atras: 0, recurrente: null }],
    ['propina 500', { accion: 'cargar', tipo: 'ingreso', monto: 500, categoria: null, descripcion: 'Propina', dias_atras: 0, recurrente: null }],
    ['saqué 100 del ahorro', { accion: 'cargar', tipo: 'ahorro', monto: -100, categoria: null, descripcion: null, dias_atras: 0, recurrente: null }],
    ['gasté 50', { accion: 'repreguntar', falta: 'categoria', tipo: 'gasto', monto: 50, dias_atras: 0 }],
    ['no, era 40', { accion: 'corregir', monto: 40 }],
    ['osea esos 30 eran salud', { accion: 'corregir', categoria: 'Salud' }],
    ['borrá eso', { accion: 'borrar' }],
    ['¿cuánto me queda?', { accion: 'consultar', consulta: 'margen_libre' }],
    ['¿cómo voy este mes?', { accion: 'consultar', consulta: 'mes' }],
    ['creá la categoría Regalos con presupuesto 150', { accion: 'crear_categoria', nombre: 'Regalos', presupuesto: 150, confirmada: false }],
    ['asdasda', { accion: 'no_entendido' }],
  ],
  en: [
    ['gas 45 yesterday', { accion: 'cargar', tipo: 'gasto', monto: 45, categoria: 'Transport', descripcion: 'Gas', dias_atras: 1, recurrente: null }],
    ['coffee 3.5', { accion: 'cargar', tipo: 'gasto', monto: 3.5, categoria: 'Leisure', descripcion: 'Coffee', dias_atras: 0, recurrente: null }],
    ['tip 500', { accion: 'cargar', tipo: 'ingreso', monto: 500, categoria: null, descripcion: 'Tip', dias_atras: 0, recurrente: null }],
    ['took 100 out of savings', { accion: 'cargar', tipo: 'ahorro', monto: -100, categoria: null, descripcion: null, dias_atras: 0, recurrente: null }],
    ['spent 50', { accion: 'repreguntar', falta: 'categoria', tipo: 'gasto', monto: 50, dias_atras: 0 }],
    ['no, it was 40', { accion: 'corregir', monto: 40 }],
    ['i mean those 30 were health', { accion: 'corregir', categoria: 'Health' }],
    ['delete that', { accion: 'borrar' }],
    ['how much do I have left?', { accion: 'consultar', consulta: 'margen_libre' }],
    ['how is the month going?', { accion: 'consultar', consulta: 'mes' }],
    ['create the category Gifts with a budget of 150', { accion: 'crear_categoria', nombre: 'Gifts', presupuesto: 150, confirmada: false }],
    ['asdasda', { accion: 'no_entendido' }],
  ],
}

/** Marks the pending-question block, so tests can check it is there only when `pending` is set. */
export const PENDING_HEADER = 'PREGUNTA PENDIENTE'
/** Marks the VIP conversation block (design D8). */
export const HISTORY_HEADER = 'CONVERSACIÓN RECIENTE'

export function buildPrompt(input: ParseInput): string {
  const language = input.locale === 'en' ? 'inglés' : 'español'
  const recurring = input.recurringNames.length > 0 ? input.recurringNames.join(', ') : '(ninguno)'
  const examples = EXAMPLES[input.locale]
    .map(([message, action]) => `Mensaje: ${message}\nJSON: ${JSON.stringify(action)}`)
    .join('\n\n')

  const sections = [
    `Sos el intérprete de un bot de finanzas personales. Convertís UN mensaje de chat en UN objeto JSON con una acción. Devolvé solo el objeto JSON, sin texto alrededor.

ACCIONES Y CAMPOS (ningún campo fuera de estos):
- {"accion":"cargar","tipo":"gasto"|"ingreso"|"ahorro","monto":número,"categoria":string|null,"descripcion":string|null,"dias_atras":entero>=0,"recurrente":string|null}
  Registrar un movimiento. monto positivo en gasto e ingreso. En ahorro, positivo es un depósito y negativo un retiro ("saqué 100 del ahorro" → -100); nunca 0.
- {"accion":"repreguntar","falta":"categoria","tipo":"gasto","monto":número,"dias_atras":entero>=0}
  Solo cuando el mensaje da un monto de gasto y NADA que describa en qué fue ("gasté 50").
- {"accion":"no_entendido"}  El mensaje no es ninguna de las otras acciones.
- {"accion":"consultar","consulta":"margen_libre"|"mes"}  "libre" o cuánto le queda → margen_libre; cómo viene el mes → mes.
- {"accion":"corregir","monto"?:número,"categoria"?:string}  Corrige la última carga; al menos uno de los dos.
- {"accion":"borrar"}  Borra la última carga ("borrá eso").
- {"accion":"crear_categoria","nombre":string,"presupuesto"?:número,"confirmada":boolean}  Solo cuando el mensaje pide crear una categoría. nombre con la ortografía correcta, tildes incluidas; presupuesto solo si el mensaje lo da (positivo); confirmada es false salvo que el mensaje confirme la pregunta pendiente.`,

    `DATOS DE LA CUENTA
Hoy es ${input.today}. Idioma de la cuenta: ${language}; los mensajes llegan en ese idioma.
Categorías: ${input.categories.join(', ')}
Gastos fijos activos: ${recurring}`,

    `REGLAS
- categoria: exactamente uno de los nombres de "Categorías", escrito igual. Nunca inventes una. Si hay descripción pero ninguna categoría encaja, usá "Otros". En ingreso y ahorro, categoria es null.
- Toda descripción, aunque sea vaga ("cosas 50"), se carga: nunca repreguntar si hay alguna palabra que describa el gasto.
- descripcion: dos o tres palabras con mayúscula inicial ("Propina", "Nafta"); null si el mensaje solo tiene el verbo y el monto.
- recurrente: el nombre exacto de un "Gasto fijo activo" solo cuando el mensaje lo nombra; si no, null. En ingreso y ahorro siempre null.
- "cobré", "me pagaron", "propina", "sueldo" son ingreso; "ahorré", "guardé" son ahorro.
- monto: número JSON, nunca string. La coma es separador decimal ("3,5" → 3.5); ignorá la puntuación final.
- dias_atras: 0 si el mensaje no nombra un día; "ayer" → 1; "anteayer" → 2; "hace N días" → N. "date" es una cita (Ocio), no una fecha.
- corregir: cualquier forma de decir que la última carga estaba mal, aunque sea suelta ("osea lo que gasté esos 50 eran comida" → corregir con categoria "Comida"; "no, eran 80" → corregir con monto 80). Un monto que solo repite el de la carga para identificarla no es un monto nuevo.
- Un "sí", "dale" u "ok" suelto, sin una pregunta pendiente que confirme, es no_entendido.`,

    `EJEMPLOS\n${examples}`,
  ]

  if (input.history && input.history.length > 0) {
    const lines = input.history.map((message) => `${message.direction === 'entrante' ? 'Usuario' : 'Mango'}: ${message.text}`)
    sections.push(`${HISTORY_HEADER}
Los últimos mensajes de este chat, del más viejo al más nuevo. Usalos solo para entender el MENSAJE (por ejemplo, "lo mismo que ayer"); devolvé una sola acción para el MENSAJE.
${lines.join('\n')}`)
  }

  if (input.pending?.pregunta === 'categoria') {
    const { tipo, monto, diasAtras } = input.pending
    sections.push(`${PENDING_HEADER}
En el turno anterior el bot preguntó qué categoría corresponde a un ${tipo} de ${monto} (dias_atras ${diasAtras}). Si este mensaje responde esa pregunta con una categoría, devolvé "cargar" con tipo "${tipo}", monto ${monto}, dias_atras ${diasAtras} y esa categoría. Si el mensaje es otra cosa (por ejemplo, un gasto nuevo con su propio monto), interpretalo por sí solo e ignorá la pregunta.`)
  } else if (input.pending?.pregunta === 'crear_categoria') {
    const { nombre, presupuesto, parecida } = input.pending
    const campos = { accion: 'crear_categoria', nombre, ...(presupuesto ? { presupuesto } : {}), confirmada: true }
    sections.push(`${PENDING_HEADER}
En el turno anterior el bot preguntó si crea la categoría "${nombre}" aunque ya existe "${parecida}". Si este mensaje lo confirma ("sí", "dale", "creala"), devolvé ${JSON.stringify(campos)}. Si el mensaje es otra cosa, interpretalo por sí solo e ignorá la pregunta; confirmada solo es true en esa confirmación.`)
  }

  sections.push(`MENSAJE\n${input.text}`)
  return sections.join('\n\n')
}

const NOT_UNDERSTOOD: Action = { accion: 'no_entendido' }

/**
 * Calls `model` at most twice: a second time with the previous output and what was wrong with it
 * when the first output is not JSON, fails the schema or the call throws. Two failures →
 * `no_entendido`, or `no_disponible` when both calls threw (the model never answered); an
 * unvalidated object is never returned.
 */
export async function parseMessage(input: ParseInput, model: Model): Promise<ParseResult> {
  const prompt = buildPrompt(input)
  let retryPrompt = prompt
  let answered = false

  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string
    try {
      raw = await model(attempt === 0 ? prompt : retryPrompt)
    } catch (error) {
      console.warn(`[parser] model call failed (attempt ${attempt + 1}):`, error)
      continue
    }
    answered = true

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch (error) {
      retryPrompt = withFeedback(prompt, raw, `No es JSON válido: ${(error as Error).message}`)
      continue
    }

    const result = ActionSchema.safeParse(json)
    if (result.success) return result.data
    retryPrompt = withFeedback(prompt, raw, z.prettifyError(result.error))
  }

  return answered ? NOT_UNDERSTOOD : { accion: 'no_disponible' }
}

function withFeedback(prompt: string, previous: string, issues: string): string {
  return `${prompt}

INTENTO ANTERIOR (inválido)
${previous}

Problemas:
${issues}

Devolvé solo el objeto JSON corregido.`
}

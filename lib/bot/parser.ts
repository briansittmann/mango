/**
 * Chat message → one validated action (`bot-message-parsing`, design D1–D3). Pure module: the
 * model call is injected and only relative imports are used, so `parser.eval.mjs` and the unit
 * tests load it from plain Node without Next. A voice note goes to the model as audio in the same
 * call, and the action then carries `transcripcion` (`add-voice-messages` D4).
 */

import { z } from 'zod'

const tipo = z.enum(['gasto', 'ingreso', 'ahorro'])
const diasAtras = z.number().int().min(0).default(0)

const CargarSchema = z
  .strictObject({
    accion: z.literal('cargar'),
    // `transferencia` moves money between the pockets (`payment-method`, design D10).
    tipo: z.enum(['gasto', 'ingreso', 'ahorro', 'transferencia']),
    monto: z.number(),
    categoria: z.string().min(1).nullable().default(null),
    descripcion: z.string().min(1).nullable().default(null),
    dias_atras: diasAtras,
    recurrente: z.string().min(1).nullable().default(null),
    /** What the message said, never a default; for a transfer, the pocket the money goes into. */
    medio_pago: z.enum(['efectivo', 'tarjeta']).nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.tipo === 'ahorro' ? value.monto === 0 : value.monto <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['monto'],
        message: value.tipo === 'ahorro' ? 'ahorro needs a non-zero monto' : `${value.tipo} needs a positive monto`,
      })
    }
    if (value.tipo === 'transferencia') {
      if (value.medio_pago == null) ctx.addIssue({ code: 'custom', path: ['medio_pago'], message: 'transferencia needs medio_pago, the pocket it goes into' })
      if (value.categoria != null) ctx.addIssue({ code: 'custom', path: ['categoria'], message: 'transferencia has no categoria' })
      if (value.recurrente != null) ctx.addIssue({ code: 'custom', path: ['recurrente'], message: 'transferencia has no recurrente' })
    }
    if (value.tipo === 'ahorro' && value.medio_pago != null) {
      ctx.addIssue({ code: 'custom', path: ['medio_pago'], message: 'ahorro has no medio_pago' })
    }
  })

/** Several movements in one message (`add-bot-batch-loads` D1), each one a full `cargar`, in the message's order. */
const CargarVariosSchema = z.strictObject({
  accion: z.literal('cargar_varios'),
  cargas: z.array(CargarSchema).min(2).max(20),
})

/** The movement a correction or deletion names ("la nafta era 40" → "nafta"), null when it names none (D5). */
const cual = z.string().nullable().optional()

const RepreguntarSchema = z
  .strictObject({
    accion: z.literal('repreguntar'),
    // `deposito`: money into the bank that may be new income or cash moved from the cash pocket.
    falta: z.enum(['categoria', 'deposito']),
    tipo,
    monto: z.number().positive(),
    dias_atras: diasAtras,
    descripcion: z.string().min(1).nullable().optional(),
  })
  .refine((value) => value.falta !== 'deposito' || value.tipo === 'ingreso', {
    path: ['tipo'],
    message: 'a deposito question is about an ingreso',
  })

const NoEntendidoSchema = z.strictObject({ accion: z.literal('no_entendido') })

const ConsultarSchema = z.strictObject({ accion: z.literal('consultar'), consulta: z.enum(['margen_libre', 'mes']) })

const CorregirSchema = z
  .strictObject({
    accion: z.literal('corregir'),
    monto: z.number().positive().optional(),
    categoria: z.string().min(1).optional(),
    cual,
  })
  .refine((value) => value.monto !== undefined || value.categoria !== undefined, {
    message: 'corregir needs monto or categoria',
  })

const BorrarSchema = z.strictObject({ accion: z.literal('borrar'), cual })

const CrearCategoriaSchema = z.strictObject({
  accion: z.literal('crear_categoria'),
  nombre: z.string().min(1),
  presupuesto: z.number().positive().optional(),
  confirmada: z.boolean().default(false),
})

export const ActionSchema = z.discriminatedUnion('accion', [
  CargarSchema,
  CargarVariosSchema,
  RepreguntarSchema,
  NoEntendidoSchema,
  ConsultarSchema,
  CorregirSchema,
  BorrarSchema,
  CrearCategoriaSchema,
])

/** The literal text heard; empty when no speech was intelligible. `extend` keeps each variant's refinements. */
const transcripcion = { transcripcion: z.string() }

/** The same variants, each with `transcripcion` (a list carries one, outside its items), so the two schemas never drift. */
export const VoiceActionSchema = z.discriminatedUnion('accion', [
  CargarSchema.extend(transcripcion),
  CargarVariosSchema.extend(transcripcion),
  RepreguntarSchema.extend(transcripcion),
  NoEntendidoSchema.extend(transcripcion),
  ConsultarSchema.extend(transcripcion),
  CorregirSchema.extend(transcripcion),
  BorrarSchema.extend(transcripcion),
  CrearCategoriaSchema.extend(transcripcion),
])

export type Action = z.infer<typeof ActionSchema>

/** An action (with `transcripcion` when the input was audio), or `no_disponible` when the model never answered. */
export type ParseResult = (Action & { transcripcion?: string }) | { accion: 'no_disponible' }

/**
 * The question the channel holds (design D5): a category for an amount, or whether to create a
 * category whose name is close to `parecida`.
 */
export type PendingQuestion =
  | { pregunta: 'categoria'; tipo: 'gasto' | 'ingreso' | 'ahorro'; monto: number; diasAtras: number }
  | { pregunta: 'crear_categoria'; nombre: string; presupuesto: number | null; parecida: string }
  /** Income or cash moved from the cash pocket, for an amount put into the bank (`payment-method`, D10). */
  | { pregunta: 'deposito'; monto: number; diasAtras: number; descripcion: string | null }
  /** Whether an expense naming a fixed charge already charged this cycle is a separate payment (`bot-transaction-logging`). */
  | { pregunta: 'cargo_repetido'; nombre: string; categoria: string; monto: number; diasAtras: number; medioPago: 'efectivo' | 'tarjeta' | null }

export type AudioInput = { data: Uint8Array; mimeType: string }

export type ParseInput = {
  text: string
  /** A voice note's bytes; `text` is ignored then and the model transcribes it itself (D4). */
  audio?: AudioInput
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
  /** Whether the account is offered the payment-method feature (D14); without it the prompt has no method, transfer or deposit rule. */
  paymentMethods?: boolean
}

export type ModelRequest = { prompt: string; audio?: AudioInput }
export type Model = (request: ModelRequest) => Promise<string>

const EXAMPLES: Record<ParseInput['locale'], [string, object][]> = {
  es: [
    ['nafta 45 ayer', { accion: 'cargar', tipo: 'gasto', monto: 45, categoria: 'Transporte', descripcion: 'Nafta', dias_atras: 1, recurrente: null, medio_pago: null }],
    ['cafe 3,5.', { accion: 'cargar', tipo: 'gasto', monto: 3.5, categoria: 'Ocio', descripcion: 'Café', dias_atras: 0, recurrente: null, medio_pago: null }],
    ['pagué 15 en efectivo de cervezas', { accion: 'cargar', tipo: 'gasto', monto: 15, categoria: 'Ocio', descripcion: 'Cervezas', dias_atras: 0, recurrente: null, medio_pago: 'efectivo' }],
    ['propina 500', { accion: 'cargar', tipo: 'ingreso', monto: 500, categoria: null, descripcion: 'Propina', dias_atras: 0, recurrente: null, medio_pago: null }],
    ['saqué 100 del ahorro', { accion: 'cargar', tipo: 'ahorro', monto: -100, categoria: null, descripcion: null, dias_atras: 0, recurrente: null, medio_pago: null }],
    ['saqué 200', { accion: 'cargar', tipo: 'transferencia', monto: 200, categoria: null, descripcion: null, dias_atras: 0, recurrente: null, medio_pago: 'efectivo' }],
    ['deposité las propinas, 120', { accion: 'cargar', tipo: 'transferencia', monto: 120, categoria: null, descripcion: null, dias_atras: 0, recurrente: null, medio_pago: 'tarjeta' }],
    ['ingresé 200 en el banco', { accion: 'repreguntar', falta: 'deposito', tipo: 'ingreso', monto: 200, dias_atras: 0 }],
    ['gasté 50', { accion: 'repreguntar', falta: 'categoria', tipo: 'gasto', monto: 50, dias_atras: 0 }],
    ['café 3, súper 25 y nafta 40', { accion: 'cargar_varios', cargas: [
      { accion: 'cargar', tipo: 'gasto', monto: 3, categoria: 'Ocio', descripcion: 'Café', dias_atras: 0, recurrente: null, medio_pago: null },
      { accion: 'cargar', tipo: 'gasto', monto: 25, categoria: 'Comida', descripcion: 'Súper', dias_atras: 0, recurrente: null, medio_pago: null },
      { accion: 'cargar', tipo: 'gasto', monto: 40, categoria: 'Transporte', descripcion: 'Nafta', dias_atras: 0, recurrente: null, medio_pago: null },
    ] }],
    ['farmacia 12\npropina 500', { accion: 'cargar_varios', cargas: [
      { accion: 'cargar', tipo: 'gasto', monto: 12, categoria: 'Salud', descripcion: 'Farmacia', dias_atras: 0, recurrente: null, medio_pago: null },
      { accion: 'cargar', tipo: 'ingreso', monto: 500, categoria: null, descripcion: 'Propina', dias_atras: 0, recurrente: null, medio_pago: null },
    ] }],
    ['no, era 40', { accion: 'corregir', monto: 40, cual: null }],
    ['la nafta era 40', { accion: 'corregir', monto: 40, cual: 'nafta' }],
    ['osea esos 30 eran salud', { accion: 'corregir', categoria: 'Salud', cual: null }],
    ['borrá eso', { accion: 'borrar', cual: null }],
    ['borrá el cine', { accion: 'borrar', cual: 'cine' }],
    ['¿cuánto me queda?', { accion: 'consultar', consulta: 'margen_libre' }],
    ['¿cómo voy este mes?', { accion: 'consultar', consulta: 'mes' }],
    ['creá la categoría Regalos con presupuesto 150', { accion: 'crear_categoria', nombre: 'Regalos', presupuesto: 150, confirmada: false }],
    ['asdasda', { accion: 'no_entendido' }],
  ],
  en: [
    ['gas 45 yesterday', { accion: 'cargar', tipo: 'gasto', monto: 45, categoria: 'Transport', descripcion: 'Gas', dias_atras: 1, recurrente: null, medio_pago: null }],
    ['coffee 3.5', { accion: 'cargar', tipo: 'gasto', monto: 3.5, categoria: 'Leisure', descripcion: 'Coffee', dias_atras: 0, recurrente: null, medio_pago: null }],
    ['paid 15 in cash for beers', { accion: 'cargar', tipo: 'gasto', monto: 15, categoria: 'Leisure', descripcion: 'Beers', dias_atras: 0, recurrente: null, medio_pago: 'efectivo' }],
    ['tip 500', { accion: 'cargar', tipo: 'ingreso', monto: 500, categoria: null, descripcion: 'Tip', dias_atras: 0, recurrente: null, medio_pago: null }],
    ['took 100 out of savings', { accion: 'cargar', tipo: 'ahorro', monto: -100, categoria: null, descripcion: null, dias_atras: 0, recurrente: null, medio_pago: null }],
    ['took 200 out of the ATM', { accion: 'cargar', tipo: 'transferencia', monto: 200, categoria: null, descripcion: null, dias_atras: 0, recurrente: null, medio_pago: 'efectivo' }],
    ['deposited the tips, 120', { accion: 'cargar', tipo: 'transferencia', monto: 120, categoria: null, descripcion: null, dias_atras: 0, recurrente: null, medio_pago: 'tarjeta' }],
    ['put 200 in the bank', { accion: 'repreguntar', falta: 'deposito', tipo: 'ingreso', monto: 200, dias_atras: 0 }],
    ['spent 50', { accion: 'repreguntar', falta: 'categoria', tipo: 'gasto', monto: 50, dias_atras: 0 }],
    ['coffee 3, groceries 25 and gas 40', { accion: 'cargar_varios', cargas: [
      { accion: 'cargar', tipo: 'gasto', monto: 3, categoria: 'Leisure', descripcion: 'Coffee', dias_atras: 0, recurrente: null, medio_pago: null },
      { accion: 'cargar', tipo: 'gasto', monto: 25, categoria: 'Food', descripcion: 'Groceries', dias_atras: 0, recurrente: null, medio_pago: null },
      { accion: 'cargar', tipo: 'gasto', monto: 40, categoria: 'Transport', descripcion: 'Gas', dias_atras: 0, recurrente: null, medio_pago: null },
    ] }],
    ['pharmacy 12\ntip 500', { accion: 'cargar_varios', cargas: [
      { accion: 'cargar', tipo: 'gasto', monto: 12, categoria: 'Health', descripcion: 'Pharmacy', dias_atras: 0, recurrente: null, medio_pago: null },
      { accion: 'cargar', tipo: 'ingreso', monto: 500, categoria: null, descripcion: 'Tip', dias_atras: 0, recurrente: null, medio_pago: null },
    ] }],
    ['no, it was 40', { accion: 'corregir', monto: 40, cual: null }],
    ['the gas was 40', { accion: 'corregir', monto: 40, cual: 'gas' }],
    ['i mean those 30 were health', { accion: 'corregir', categoria: 'Health', cual: null }],
    ['delete that', { accion: 'borrar', cual: null }],
    ['delete the movies', { accion: 'borrar', cual: 'movies' }],
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
/** Marks the voice-note rules, present only when the input is audio (`add-voice-messages` D4). */
export const VOICE_HEADER = 'NOTA DE VOZ'

/** The method, transfer and deposit rules: only for an account offered the feature (D14). */
const PAYMENT_RULES = `
- medio_pago: en gasto e ingreso, el que dice el mensaje ("en efectivo", "cash" → "efectivo"; "con tarjeta", "con débito", "by card" → "tarjeta"); null si no lo dice. Nunca lo adivines ni pongas uno por defecto. En ahorro siempre null.
- transferencia: mover plata entre el efectivo y el banco, sin gastar ni cobrar nada. Sacar plata del banco o del cajero ("saqué 200", "saqué del cajero", "retiré 100") → tipo "transferencia" con medio_pago "efectivo". Poner efectivo en el banco ("deposité las propinas", "ingresé el efectivo al banco") → tipo "transferencia" con medio_pago "tarjeta". En transferencia, categoria, descripcion y recurrente son null y medio_pago nunca es null. Sacar del ahorro ("saqué 100 del ahorro") NO es transferencia: es ahorro con monto negativo.
- Plata que entra al banco sin decir si vino del efectivo o es plata nueva ("ingresé 200 en el banco", "metí 200 en la cuenta") → repreguntar con falta "deposito", tipo "ingreso" y el monto. Si el mensaje lo dice, no preguntes: "cobré 200 en el banco" es ingreso con medio_pago "tarjeta"; "deposité 200 del efectivo" es transferencia con medio_pago "tarjeta". Nunca preguntes el medio de pago en otro caso.`

/** An example about the payment method, a transfer or the deposit question: only for an account offered the feature. */
function paymentExample(action: object): boolean {
  const a = action as { tipo?: string; falta?: string; medio_pago?: string | null }
  return a.tipo === 'transferencia' || a.falta === 'deposito' || a.medio_pago != null
}

/** Without the feature the examples carry no `medio_pago` at all, so nothing in the prompt names it. */
function withoutMethod(action: object): object {
  const rest: Record<string, unknown> = { ...action }
  delete rest.medio_pago
  if (Array.isArray(rest.cargas)) rest.cargas = rest.cargas.map(withoutMethod)
  return rest
}

export function buildPrompt(input: ParseInput): string {
  const voice = input.audio !== undefined
  const payments = input.paymentMethods !== false
  const language = input.locale === 'en' ? 'inglés' : 'español'
  const recurring = input.recurringNames.length > 0 ? input.recurringNames.join(', ') : '(ninguno)'
  // With audio, every action carries the transcription: the list and the examples show it.
  const T = voice ? ',"transcripcion":string' : ''
  const examples = [
    ...EXAMPLES[input.locale]
      .filter(([, action]) => payments || !paymentExample(action))
      .map(([message, example]) => {
        const action = payments ? example : withoutMethod(example)
        return `Mensaje: ${message}\nJSON: ${JSON.stringify(voice ? { ...action, transcripcion: message } : action)}`
      }),
    ...(voice ? [`Nota de voz: (silencio, ruido de fondo o nada inteligible)\nJSON: ${JSON.stringify({ accion: 'no_entendido', transcripcion: '' })}`] : []),
  ].join('\n\n')

  const sections = [
    `Sos el intérprete de un bot de finanzas personales. Convertís UN mensaje de chat en UN objeto JSON con una acción. Devolvé solo el objeto JSON, sin texto alrededor.

ACCIONES Y CAMPOS (ningún campo fuera de estos):
${
      payments
        ? `- {"accion":"cargar","tipo":"gasto"|"ingreso"|"ahorro"|"transferencia","monto":número,"categoria":string|null,"descripcion":string|null,"dias_atras":entero>=0,"recurrente":string|null,"medio_pago":"efectivo"|"tarjeta"|null${T}}
  Registrar un movimiento. monto positivo en gasto, ingreso y transferencia. En ahorro, positivo es un depósito y negativo un retiro ("saqué 100 del ahorro" → -100); nunca 0.
- {"accion":"repreguntar","falta":"categoria"|"deposito","tipo":"gasto"|"ingreso","monto":número,"dias_atras":entero>=0,"descripcion"?:string${T}}
  falta "categoria" (tipo "gasto"): solo cuando el mensaje da un monto de gasto y NADA que describa en qué fue ("gasté 50"). falta "deposito" (tipo "ingreso"): ver la regla de transferencia.`
        : `- {"accion":"cargar","tipo":"gasto"|"ingreso"|"ahorro","monto":número,"categoria":string|null,"descripcion":string|null,"dias_atras":entero>=0,"recurrente":string|null${T}}
  Registrar un movimiento. monto positivo en gasto e ingreso. En ahorro, positivo es un depósito y negativo un retiro ("saqué 100 del ahorro" → -100); nunca 0.
- {"accion":"repreguntar","falta":"categoria","tipo":"gasto","monto":número,"dias_atras":entero>=0${T}}
  Solo cuando el mensaje da un monto de gasto y NADA que describa en qué fue ("gasté 50").`
    }
- {"accion":"cargar_varios","cargas":[objeto cargar, …]${T}}
  Varios movimientos en el mismo mensaje: un objeto "cargar" completo por movimiento, en el orden del mensaje, entre 2 y 20.
- {"accion":"no_entendido"${T}}  El mensaje no es ninguna de las otras acciones.
- {"accion":"consultar","consulta":"margen_libre"|"mes"${T}}  "libre" o cuánto le queda → margen_libre; cómo viene el mes → mes.
- {"accion":"corregir","monto"?:número,"categoria"?:string,"cual":string|null${T}}  Corrige la última carga; al menos uno de monto y categoria.
- {"accion":"borrar","cual":string|null${T}}  Borra la última carga ("borrá eso").
- {"accion":"crear_categoria","nombre":string,"presupuesto"?:número,"confirmada":boolean${T}}  Solo cuando el mensaje pide crear una categoría. nombre con la ortografía correcta, tildes incluidas; presupuesto solo si el mensaje lo da (positivo); confirmada es false salvo que el mensaje confirme la pregunta pendiente.`,

    `DATOS DE LA CUENTA
Hoy es ${input.today}. Idioma de la cuenta: ${language}; los mensajes llegan en ese idioma.
Categorías: ${input.categories.join(', ')}
Gastos fijos activos: ${recurring}`,

    `REGLAS
- categoria: exactamente uno de los nombres de "Categorías", escrito igual. Nunca inventes una. Si hay descripción pero ninguna categoría encaja, usá "Otros". En ingreso y ahorro, categoria es null.
- Toda descripción, aunque sea vaga ("cosas 50"), se carga: nunca repreguntar si hay alguna palabra que describa el gasto.
- descripcion: dos o tres palabras con mayúscula inicial ("Propina", "Nafta"); null si el mensaje solo tiene el verbo y el monto.
- recurrente: el nombre exacto de un "Gasto fijo activo" solo cuando el mensaje lo nombra; si no, null. En ingreso y ahorro siempre null. Si el mensaje pide cargarlo aparte, como otro pago o uno nuevo aunque ya esté anotado, recurrente es null y la categoria es la que nombre o la que corresponda.
- "cobré", "me pagaron", "propina", "sueldo" son ingreso; "ahorré", "guardé" son ahorro.
- monto: número JSON, nunca string. La coma es separador decimal ("3,5" → 3.5); ignorá la puntuación final.
- dias_atras: 0 si el mensaje no nombra un día; "ayer" → 1; "anteayer" → 2; "hace N días" → N. "date" es una cita (Ocio), no una fecha.
- corregir: cualquier forma de decir que la última carga estaba mal, aunque sea suelta ("osea lo que gasté esos 50 eran comida" → corregir con categoria "Comida"; "no, eran 80" → corregir con monto 80). Un monto que solo repite el de la carga para identificarla no es un monto nuevo.
- Varios movimientos en un mensaje, separados por coma, por "y" o uno por línea ("café 3, súper 25 y nafta 40") → cargar_varios, con un cargar por movimiento en el orden del mensaje; cada uno sigue todas estas reglas. Un solo movimiento es siempre cargar.
- cual: en corregir y borrar, el movimiento que el mensaje nombra como el que hay que cambiar, en una o dos palabras sin artículo ("la nafta era 40" → "nafta"; "borrá el cine" → "cine"); null si no nombra ninguno ("no, era 40", "borrá eso").
- Un "sí", "dale" u "ok" suelto, sin una pregunta pendiente que confirme, es no_entendido.${payments ? PAYMENT_RULES : ''}`,
  ]

  if (voice) {
    sections.push(`${VOICE_HEADER}
El mensaje es la nota de voz adjunta. Primero transcribila literalmente en "transcripcion" (las cifras como se dijeron: "café tres cincuenta") y después devolvé la acción para esa transcripción. Toda acción lleva "transcripcion".
- No inventes nada. Si en el audio no se oyen palabras claras (ruido, silencio, música, voz ininteligible), "transcripcion" es "" y la acción es no_entendido. Ante la duda sobre lo que se dijo, no_entendido con lo que oíste antes que un movimiento adivinado: un gasto inventado es peor que una pregunta.
- Montos hablados: "tres cincuenta" → 3.5; "doce con cuarenta" → 12.4; "tres con veinte" → 3.2; "dos mil cien" → 2100; "cuarenta y cinco" → 45; "y medio" → ,5 ("cuatro y medio" → 4.5). "X con Y" es X,Y: la parte entera siempre va primero.
- Si la nota tiene varios movimientos, devolvé cargar_varios con todos, en el orden en que se dijeron, y una sola "transcripcion" fuera de la lista.`)
  }

  sections.push(`EJEMPLOS\n${examples}`)

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
  } else if (input.pending?.pregunta === 'deposito' && payments) {
    const { monto, diasAtras, descripcion } = input.pending
    const base = { accion: 'cargar', monto, categoria: null, dias_atras: diasAtras, recurrente: null, medio_pago: 'tarjeta' }
    sections.push(`${PENDING_HEADER}
En el turno anterior el bot preguntó si los ${monto} que entraron al banco (dias_atras ${diasAtras}) los pasó desde el efectivo o son un ingreso nuevo. Si este mensaje dice que vinieron del efectivo ("del efectivo", "lo pasé", "eran las propinas"), devolvé ${JSON.stringify({ ...base, tipo: 'transferencia', descripcion: null })}. Si dice que es plata nueva ("es nuevo", "me pagaron", "es un ingreso"), devolvé ${JSON.stringify({ ...base, tipo: 'ingreso', descripcion })}. Si el mensaje es otra cosa, interpretalo por sí solo e ignorá la pregunta.`)
  } else if (input.pending?.pregunta === 'cargo_repetido') {
    const { nombre, categoria, monto, diasAtras, medioPago } = input.pending
    const carga = { accion: 'cargar', tipo: 'gasto', monto, categoria, descripcion: nombre, dias_atras: diasAtras, recurrente: null, medio_pago: medioPago }
    sections.push(`${PENDING_HEADER}
En el turno anterior el bot avisó que el gasto fijo "${nombre}" ya está cobrado este ciclo y preguntó si los ${monto} son otro pago aparte. Si este mensaje lo confirma ("sí", "cargalo", "es otro"), devolvé ${JSON.stringify(carga)}. Si el mensaje es otra cosa, interpretalo por sí solo e ignorá la pregunta.`)
  }

  sections.push(
    voice
      ? 'MENSAJE\nLa nota de voz adjunta. Si no se oye ninguna palabra, devolvé exactamente {"accion":"no_entendido","transcripcion":""}.'
      : `MENSAJE\n${input.text}`,
  )
  return sections.join('\n\n')
}

const NOT_UNDERSTOOD: Action = { accion: 'no_entendido' }

/**
 * Calls `model` at most twice: a second time with the previous output and what was wrong with it
 * when the first output is not JSON, fails the schema or the call throws. Two failures →
 * `no_entendido`, or `no_disponible` when both calls threw (the model never answered); an
 * unvalidated object is never returned. With audio, the retry re-sends the audio and the output
 * is validated with `VoiceActionSchema`, so an action without `transcripcion` is a schema error.
 */
export async function parseMessage(input: ParseInput, model: Model): Promise<ParseResult> {
  const prompt = buildPrompt(input)
  const schema = input.audio ? VoiceActionSchema : ActionSchema
  let retryPrompt = prompt
  let answered = false

  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string
    try {
      raw = await model({ prompt: attempt === 0 ? prompt : retryPrompt, audio: input.audio })
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

    const result = schema.safeParse(normalize(json))
    if (result.success) return result.data
    retryPrompt = withFeedback(prompt, raw, z.prettifyError(result.error))
  }

  return answered ? NOT_UNDERSTOOD : { accion: 'no_disponible' }
}

/**
 * A bare list of `cargar` objects, which the model tends to emit for several movements, is the
 * `cargar_varios` it means, and a one-item list is that item: neither costs a retry (D1).
 */
function normalize(json: unknown): unknown {
  if (!Array.isArray(json)) return json
  if (json.length === 1) return json[0]
  return { accion: 'cargar_varios', cargas: json }
}

function withFeedback(prompt: string, previous: string, issues: string): string {
  return `${prompt}

INTENTO ANTERIOR (inválido)
${previous}

Problemas:
${issues}

Devolvé solo el objeto JSON corregido.`
}

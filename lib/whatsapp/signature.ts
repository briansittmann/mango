import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Valida el header `X-Hub-Signature-256`: HMAC SHA-256 del cuerpo **crudo** con
 * el App Secret de Meta (ARCHITECTURE.md §3 y §10). Sin esto cualquiera puede
 * pegarle al endpoint.
 */
export function firmaValida(
  cuerpoCrudo: Buffer,
  header: string | null,
  appSecret: string
): boolean {
  if (!header) return false

  const [algoritmo, firmaRecibida] = header.split('=')
  if (algoritmo !== 'sha256' || !firmaRecibida) return false

  const firmaEsperada = createHmac('sha256', appSecret).update(cuerpoCrudo).digest('hex')
  return comparacionSegura(firmaRecibida, firmaEsperada)
}

/**
 * Comparación en tiempo constante. Compara los digest SHA-256 y no las cadenas
 * directas por dos motivos: `timingSafeEqual` tira si los buffers miden
 * distinto, y comparar longitudes antes filtraría el largo del secreto.
 */
export function comparacionSegura(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest()
  const digestB = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(digestA, digestB)
}

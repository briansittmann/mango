import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Validates the `X-Hub-Signature-256` header: HMAC SHA-256 of the **raw**
 * body with Meta's App Secret (ARCHITECTURE.md §3 and §10). Without this,
 * anyone could hit the endpoint.
 */
export function isValidSignature(
  rawBody: Buffer,
  header: string | null,
  appSecret: string
): boolean {
  if (!header) return false

  const [algorithm, receivedSignature] = header.split('=')
  if (algorithm !== 'sha256' || !receivedSignature) return false

  const expectedSignature = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return safeCompare(receivedSignature, expectedSignature)
}

/**
 * Constant-time comparison. Compares the SHA-256 digests rather than the raw
 * strings for two reasons: `timingSafeEqual` throws if the buffers have
 * different lengths, and comparing lengths beforehand would leak the
 * secret's length.
 */
export function safeCompare(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest()
  const digestB = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(digestA, digestB)
}

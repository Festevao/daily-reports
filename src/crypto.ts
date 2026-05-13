import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_ENV = 'PAYLOAD_ENCRYPTION_KEY'

function getKey(): Buffer {
  const raw = process.env[KEY_ENV]
  if (!raw) throw new Error(`Missing environment variable: ${KEY_ENV}`)
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== 32) {
    throw new Error(`${KEY_ENV} must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32`)
  }
  return buf
}

export interface EncryptedEnvelope {
  iv: string
  tag: string
  data: string
}

/**
 * Encrypts a JSON-serializable payload using AES-256-GCM.
 * Returns an envelope with iv, auth tag, and ciphertext — all base64-encoded.
 */
export function encryptPayload(payload: unknown): EncryptedEnvelope {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const json = JSON.stringify(payload)
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  }
}

/**
 * Decrypts an envelope produced by encryptPayload.
 * Returns the original payload as a parsed object.
 */
export function decryptPayload<T = unknown>(envelope: EncryptedEnvelope): T {
  const key = getKey()
  const iv = Buffer.from(envelope.iv, 'base64')
  const tag = Buffer.from(envelope.tag, 'base64')
  const data = Buffer.from(envelope.data, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(decrypted.toString('utf8')) as T
}

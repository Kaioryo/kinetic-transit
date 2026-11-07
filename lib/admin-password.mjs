import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const deriveKey = promisify(scrypt)
const KEY_LENGTH = 32
const SCRYPT_OPTIONS = { N: 2 ** 15, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }

/** @param {unknown} password */
function isPasswordInput(password) {
  return typeof password === 'string' && password.length > 0 && Buffer.byteLength(password) <= 1024
}

/** @param {string} password */
export async function hashAdminPassword(password) {
  if (!isPasswordInput(password)) throw new Error('Kata sandi admin harus berukuran 1–1024 byte.')

  const salt = randomBytes(16)
  const key = await deriveKey(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
  return `scrypt-v1:${salt.toString('hex')}:${key.toString('hex')}`
}

/**
 * @param {unknown} password
 * @param {string | undefined} encodedHash
 * @returns {Promise<boolean | null>} null jika hash belum dikonfigurasi dengan benar.
 */
export async function verifyAdminPassword(password, encodedHash) {
  const match = encodedHash?.match(/^scrypt-v1:([0-9a-f]{32}):([0-9a-f]{64})$/)
  if (!match) return null
  if (!isPasswordInput(password)) return false

  const [, salt, key] = match
  const actualKey = await deriveKey(password, Buffer.from(salt, 'hex'), KEY_LENGTH, SCRYPT_OPTIONS)
  return timingSafeEqual(actualKey, Buffer.from(key, 'hex'))
}

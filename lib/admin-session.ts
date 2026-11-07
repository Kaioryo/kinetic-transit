import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'admin_session'
const SESSION_MAX_AGE = 8 * 60 * 60
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

function getSigningKey() {
  const secret = process.env.ADMIN_SESSION_SECRET
  return secret && /^[0-9a-f]{64}$/i.test(secret) ? Buffer.from(secret, 'hex') : null
}

function sign(payload: string, key: Buffer) {
  return createHmac('sha256', key).update(payload).digest()
}

export async function startAdminSession() {
  const key = getSigningKey()
  if (!key) return false

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  const nonce = randomBytes(16).toString('hex')
  const payload = `${expiresAt}.${nonce}`
  const signature = sign(payload, key).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, `${payload}.${signature}`, { ...COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE })
  return true
}

export async function hasAdminSession() {
  const key = getSigningKey()
  if (!key) return false

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const match = token?.match(/^([0-9]{1,12})\.([0-9a-f]{32})\.([0-9a-f]{64})$/)
  if (!match) return false

  const [, expiresAt, nonce, signature] = match
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false

  return timingSafeEqual(sign(`${expiresAt}.${nonce}`, key), Buffer.from(signature, 'hex'))
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}

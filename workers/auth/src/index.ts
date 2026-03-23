import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT, jwtVerify } from 'jose'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://ideavault.pages.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

function nanoid() {
  return crypto.randomUUID().replace(/-/g, '')
}

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'])
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  const hashArr = Array.from(new Uint8Array(bits))
  const saltArr = Array.from(salt)
  return `${saltArr.map(b => b.toString(16).padStart(2, '0')).join('')}:${hashArr.map(b => b.toString(16).padStart(2, '0')).join('')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  const hashArr = Array.from(new Uint8Array(bits))
  const computedHex = hashArr.map(b => b.toString(16).padStart(2, '0')).join('')
  return computedHex === hashHex
}

async function signToken(userId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(key)
}

export async function verifyToken(token: string, secret: string): Promise<{ sub: string } | null> {
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const { payload } = await jwtVerify(token, key)
    return payload as { sub: string }
  } catch {
    return null
  }
}

app.post('/register', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first()
  if (existing) return c.json({ error: 'Email already in use' }, 409)

  const id = nanoid()
  const hash = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').bind(id, email.toLowerCase(), hash).run()

  const token = await signToken(id, c.env.JWT_SECRET)
  return c.json({ token, user: { id, email: email.toLowerCase() } })
})

app.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

  const user = await c.env.DB.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').bind(email.toLowerCase()).first<{ id: string; email: string; password_hash: string }>()
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const token = await signToken(user.id, c.env.JWT_SECRET)
  return c.json({ token, user: { id: user.id, email: user.email } })
})

app.get('/me', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const payload = await verifyToken(auth.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT id, email, created_at FROM users WHERE id = ?').bind(payload.sub).first<{ id: string; email: string; created_at: number }>()
  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json({ user })
})

export default app

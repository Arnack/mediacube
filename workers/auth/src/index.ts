import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT, jwtVerify } from 'jose'
import Stripe from 'stripe'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  STRIPE_SECRET: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PRICE_ID: string
}

const LIMITS = {
  free: { notes: 10, ai_calls: 10, url_parses: 5 },
  pro: { notes: Infinity, ai_calls: Infinity, url_parses: Infinity },
}

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://ideavault.pages.dev',
  'https://e4aef419.ideavault-47y.pages.dev',
  'https://master.ideavault-47y.pages.dev',
]

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({
  origin: ALLOWED_ORIGINS,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

function nanoid() {
  return crypto.randomUUID().replace(/-/g, '')
}

function getStripe(secret: string) {
  return new Stripe(secret, { apiVersion: '2024-10-28.acacia' as any })
}

function today() {
  return new Date().toISOString().slice(0, 10)
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

// ─── Helper: get usage counts for today ───
async function getUsage(db: D1Database, userId: string) {
  const d = today()
  const { results } = await db.prepare(
    'SELECT action, count FROM usage_log WHERE user_id = ? AND date = ?'
  ).bind(userId, d).all<{ action: string; count: number }>()

  const usage: Record<string, number> = {}
  for (const r of results) usage[r.action] = r.count
  return {
    note_create: usage['note_create'] ?? 0,
    ai_call: usage['ai_call'] ?? 0,
    url_parse: usage['url_parse'] ?? 0,
  }
}

// ─── Auth Routes ───

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
  return c.json({ token, user: { id, email: email.toLowerCase(), plan: 'free' } })
})

app.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

  const user = await c.env.DB.prepare('SELECT id, email, password_hash, plan FROM users WHERE email = ?').bind(email.toLowerCase()).first<{ id: string; email: string; password_hash: string; plan: string }>()
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const token = await signToken(user.id, c.env.JWT_SECRET)
  return c.json({ token, user: { id: user.id, email: user.email, plan: user.plan ?? 'free' } })
})

app.get('/me', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const payload = await verifyToken(auth.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT id, email, plan, stripe_customer_id, stripe_subscription_id, plan_expires_at, created_at FROM users WHERE id = ?').bind(payload.sub).first<{
    id: string; email: string; plan: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; plan_expires_at: number | null; created_at: number
  }>()
  if (!user) return c.json({ error: 'User not found' }, 404)

  const usage = await getUsage(c.env.DB, user.id)
  const plan = user.plan ?? 'free'
  const limits = LIMITS[plan as keyof typeof LIMITS] ?? LIMITS.free

  // Count total notes for lifetime limit
  const noteCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').bind(user.id).first<{ count: number }>()

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      plan,
      created_at: user.created_at,
    },
    subscription: {
      plan,
      stripeSubscriptionId: user.stripe_subscription_id,
      expiresAt: user.plan_expires_at,
    },
    usage: {
      notes: { used: noteCount?.count ?? 0, limit: limits.notes },
      ai_calls: { used: usage.ai_call, limit: limits.ai_calls },
      url_parses: { used: usage.url_parse, limit: limits.url_parses },
    },
  })
})

// ─── Usage endpoint (lightweight, for frequent checks) ───
app.get('/usage', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const payload = await verifyToken(auth.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT id, plan FROM users WHERE id = ?').bind(payload.sub).first<{ id: string; plan: string }>()
  if (!user) return c.json({ error: 'User not found' }, 404)

  const plan = user.plan ?? 'free'
  const limits = LIMITS[plan as keyof typeof LIMITS] ?? LIMITS.free
  const usage = await getUsage(c.env.DB, user.id)
  const noteCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').bind(user.id).first<{ count: number }>()

  return c.json({
    plan,
    usage: {
      notes: { used: noteCount?.count ?? 0, limit: limits.notes },
      ai_calls: { used: usage.ai_call, limit: limits.ai_calls },
      url_parses: { used: usage.url_parse, limit: limits.url_parses },
    },
  })
})

// ─── Increment usage (called by other workers via internal HTTP) ───
app.post('/usage/increment', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const payload = await verifyToken(auth.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const { action } = await c.req.json<{ action: string }>()
  if (!['note_create', 'ai_call', 'url_parse'].includes(action)) {
    return c.json({ error: 'Invalid action' }, 400)
  }

  const d = today()
  await c.env.DB.prepare(
    `INSERT INTO usage_log (user_id, action, date, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, action, date) DO UPDATE SET count = count + 1`
  ).bind(payload.sub, action, d).run()

  return c.json({ ok: true })
})

// ─── Check usage limit (called by other workers) ───
app.post('/usage/check', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const payload = await verifyToken(auth.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const { action } = await c.req.json<{ action: string }>()
  const user = await c.env.DB.prepare('SELECT id, plan FROM users WHERE id = ?').bind(payload.sub).first<{ id: string; plan: string }>()
  if (!user) return c.json({ error: 'User not found' }, 404)

  const plan = user.plan ?? 'free'
  if (plan === 'pro') return c.json({ allowed: true, plan })

  const limits = LIMITS.free
  const usage = await getUsage(c.env.DB, user.id)

  let allowed = true
  if (action === 'note_create') {
    const noteCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').bind(user.id).first<{ count: number }>()
    allowed = (noteCount?.count ?? 0) < limits.notes
  } else if (action === 'ai_call') {
    allowed = usage.ai_call < limits.ai_calls
  } else if (action === 'url_parse') {
    allowed = usage.url_parse < limits.url_parses
  }

  return c.json({ allowed, plan })
})

// ─── Stripe: Create Checkout Session ───
app.post('/checkout', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const payload = await verifyToken(auth.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT id, email, stripe_customer_id FROM users WHERE id = ?').bind(payload.sub).first<{
    id: string; email: string; stripe_customer_id: string | null
  }>()
  if (!user) return c.json({ error: 'User not found' }, 404)

  const stripe = getStripe(c.env.STRIPE_SECRET)

  // Create or reuse Stripe customer
  let customerId = user.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    await c.env.DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').bind(customerId, user.id).run()
  }

  const origin = c.req.header('Origin') ?? 'http://localhost:5173'
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: c.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/settings?upgraded=true`,
    cancel_url: `${origin}/pricing`,
    metadata: { userId: user.id },
  })

  return c.json({ url: session.url })
})

// ─── Stripe: Customer Portal ───
app.post('/portal', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const payload = await verifyToken(auth.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const user = await c.env.DB.prepare('SELECT id, stripe_customer_id FROM users WHERE id = ?').bind(payload.sub).first<{
    id: string; stripe_customer_id: string | null
  }>()
  if (!user?.stripe_customer_id) return c.json({ error: 'No subscription found' }, 404)

  const stripe = getStripe(c.env.STRIPE_SECRET)
  const origin = c.req.header('Origin') ?? 'http://localhost:5173'
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${origin}/settings`,
  })

  return c.json({ url: session.url })
})

// ─── Stripe: Webhook ───
app.post('/webhook', async (c) => {
  const sig = c.req.header('stripe-signature')
  if (!sig) return c.json({ error: 'Missing signature' }, 400)

  const body = await c.req.text()
  const stripe = getStripe(c.env.STRIPE_SECRET)

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, c.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('Webhook verification failed:', err.message)
    return c.json({ error: 'Invalid signature' }, 400)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (userId && session.subscription) {
        await c.env.DB.prepare(
          'UPDATE users SET plan = ?, stripe_subscription_id = ?, stripe_customer_id = ? WHERE id = ?'
        ).bind('pro', session.subscription as string, session.customer as string, userId).run()
      }
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer
      const user = await c.env.DB.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').bind(customerId).first<{ id: string }>()
      if (user) {
        const isActive = ['active', 'trialing'].includes(sub.status)
        await c.env.DB.prepare(
          'UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?'
        ).bind(isActive ? 'pro' : 'free', (sub as any).current_period_end ?? null, user.id).run()
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer
      const user = await c.env.DB.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').bind(customerId).first<{ id: string }>()
      if (user) {
        await c.env.DB.prepare(
          'UPDATE users SET plan = ?, stripe_subscription_id = NULL WHERE id = ?'
        ).bind('free', user.id).run()
      }
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as any)?.id
      if (customerId) {
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').bind(customerId).first<{ id: string }>()
        if (user) {
          console.warn(`Payment failed for user ${user.id}`)
        }
      }
      break
    }
  }

  return c.json({ received: true })
})

export default app

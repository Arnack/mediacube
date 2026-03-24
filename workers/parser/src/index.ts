import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwtVerify } from 'jose'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

type Bindings = {
  JWT_SECRET: string
  AI_WORKER_URL: string
  NOTES_WORKER_URL: string
}

type Variables = { userId: string }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}))

app.use('*', async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(c.env.JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const { payload } = await jwtVerify(auth.slice(7), key)
    c.set('userId', payload.sub as string)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})

app.post('/parse', async (c) => {
  const { url } = await c.req.json<{ url: string }>()
  if (!url) return c.json({ error: 'URL required' }, 400)

  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IdeaVault/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return c.json({ error: `Failed to fetch URL: ${res.status}` }, 422)
    html = await res.text()
  } catch (e) {
    return c.json({ error: 'Could not fetch URL' }, 422)
  }

  const { document } = parseHTML(html)
  const reader = new Readability(document as unknown as Document)
  const article = reader.parse()

  if (!article) return c.json({ error: 'Could not parse article content' }, 422)

  const text = article.textContent?.slice(0, 8000) ?? ''

  // Call AI worker for summary
  const aiRes = await fetch(`${c.env.AI_WORKER_URL}/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal': '1',
      Authorization: c.req.header('Authorization') ?? '',
    },
    body: JSON.stringify({ title: article.title, text }),
  })

  const { summary } = aiRes.ok ? await aiRes.json<{ summary: string }>() : { summary: '' }

  // Save note to notes worker
  const notesRes = await fetch(`${c.env.NOTES_WORKER_URL}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: c.req.header('Authorization') ?? '',
    },
    body: JSON.stringify({
      title: article.title ?? new URL(url).hostname,
      content: article.textContent?.slice(0, 20000) ?? '',
      type: 'link',
      url,
      summary,
    }),
  })

  if (!notesRes.ok) return c.json({ error: 'Failed to save note' }, 500)
  const { note } = await notesRes.json<{ note: any }>()

  return c.json({ note })
})

export default app

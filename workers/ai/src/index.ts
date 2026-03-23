import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwtVerify } from 'jose'
import OpenAI from 'openai'
import { DEFAULT_PROMPTS, DEFAULT_MODEL } from './defaults'

type Bindings = {
  DB: D1Database
  AI_SETTINGS: KVNamespace
  JWT_SECRET: string
  OPENAI_API_KEY: string
}

type Variables = { userId: string }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://ideavault.pages.dev', 'https://e4aef419.ideavault-47y.pages.dev', 'https://master.ideavault-47y.pages.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  credentials: true,
}))

// Auth middleware (skip for internal calls with X-Internal header from same worker network)
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

async function getSettings(kv: KVNamespace, userId: string) {
  const stored = await kv.get(`settings:${userId}`, 'json') as Record<string, string> | null
  return {
    model: stored?.model ?? DEFAULT_MODEL,
    prompts: {
      summarize: stored?.summarize ?? DEFAULT_PROMPTS.summarize,
      classify: stored?.classify ?? DEFAULT_PROMPTS.classify,
      suggestions: stored?.suggestions ?? DEFAULT_PROMPTS.suggestions,
      expand: stored?.expand ?? DEFAULT_PROMPTS.expand,
      connections: stored?.connections ?? DEFAULT_PROMPTS.connections,
    },
  }
}

function getOpenAI(apiKey: string) {
  return new OpenAI({ apiKey })
}

// GET settings
app.get('/settings', async (c) => {
  const userId = c.get('userId')
  const settings = await getSettings(c.env.AI_SETTINGS, userId)
  return c.json({ settings, defaults: { model: DEFAULT_MODEL, prompts: DEFAULT_PROMPTS } })
})

// UPDATE settings
app.put('/settings', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{ model?: string; prompts?: Partial<typeof DEFAULT_PROMPTS> }>()
  const existing = await c.env.AI_SETTINGS.get(`settings:${userId}`, 'json') as Record<string, string> | null ?? {}
  const updated = {
    ...existing,
    ...(body.model ? { model: body.model } : {}),
    ...(body.prompts ?? {}),
  }
  await c.env.AI_SETTINGS.put(`settings:${userId}`, JSON.stringify(updated))
  return c.json({ ok: true })
})

// RESET settings to defaults
app.delete('/settings', async (c) => {
  const userId = c.get('userId')
  await c.env.AI_SETTINGS.delete(`settings:${userId}`)
  return c.json({ ok: true })
})

// POST /summarize
app.post('/summarize', async (c) => {
  const userId = c.get('userId')
  const { title, text } = await c.req.json<{ title: string; text: string }>()
  const { model, prompts } = await getSettings(c.env.AI_SETTINGS, userId)
  const openai = getOpenAI(c.env.OPENAI_API_KEY)

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: prompts.summarize },
      { role: 'user', content: `Title: ${title}\n\n${text}` },
    ],
    max_tokens: 300,
  })

  return c.json({ summary: completion.choices[0].message.content ?? '' })
})

// POST /classify — suggest tags
app.post('/classify', async (c) => {
  const userId = c.get('userId')
  const { title, content } = await c.req.json<{ title: string; content?: string }>()
  const { model, prompts } = await getSettings(c.env.AI_SETTINGS, userId)
  const openai = getOpenAI(c.env.OPENAI_API_KEY)

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: prompts.classify },
      { role: 'user', content: `Title: ${title}\n\n${content?.slice(0, 2000) ?? ''}` },
    ],
    max_tokens: 100,
    response_format: { type: 'json_object' },
  })

  let tags: string[] = []
  try {
    const raw = JSON.parse(completion.choices[0].message.content ?? '[]')
    tags = Array.isArray(raw) ? raw : (raw.tags ?? [])
  } catch {}

  return c.json({ tags })
})

// POST /suggestions — idea suggestions based on recent notes
app.post('/suggestions', async (c) => {
  const userId = c.get('userId')
  const { model, prompts } = await getSettings(c.env.AI_SETTINGS, userId)
  const openai = getOpenAI(c.env.OPENAI_API_KEY)

  const { results: notes } = await c.env.DB.prepare(
    'SELECT title, summary, content FROM notes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 15'
  ).bind(userId).all<{ title: string; summary: string; content: string }>()

  const notesSummary = notes.map(n => `- ${n.title}: ${n.summary || n.content?.slice(0, 200) || ''}`).join('\n')

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: prompts.suggestions },
      { role: 'user', content: `Recent notes:\n${notesSummary}` },
    ],
    max_tokens: 600,
    response_format: { type: 'json_object' },
  })

  let suggestions: { title: string; description: string }[] = []
  try {
    const raw = JSON.parse(completion.choices[0].message.content ?? '[]')
    suggestions = Array.isArray(raw) ? raw : (raw.suggestions ?? [])
  } catch {}

  return c.json({ suggestions })
})

// POST /expand — expand idea into project outline (streaming)
app.post('/expand', async (c) => {
  const userId = c.get('userId')
  const { noteId, title, content } = await c.req.json<{ noteId?: string; title: string; content?: string }>()
  const { model, prompts } = await getSettings(c.env.AI_SETTINGS, userId)
  const openai = getOpenAI(c.env.OPENAI_API_KEY)

  let noteContent = content ?? ''
  if (noteId && !content) {
    const note = await c.env.DB.prepare('SELECT title, content, summary FROM notes WHERE id = ? AND user_id = ?').bind(noteId, userId).first<any>()
    if (note) noteContent = note.summary || note.content || ''
  }

  const stream = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: prompts.expand },
      { role: 'user', content: `Title: ${title}\n\n${noteContent.slice(0, 3000)}` },
    ],
    max_tokens: 1000,
    stream: true,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': c.req.header('Origin') ?? '*',
    },
  })
})

// POST /connections — find connections for a note (called async from notes worker)
app.post('/connections', async (c) => {
  const userId = c.get('userId')
  const { noteId } = await c.req.json<{ noteId: string }>()

  const newNote = await c.env.DB.prepare('SELECT id, title, content, summary FROM notes WHERE id = ? AND user_id = ?').bind(noteId, userId).first<any>()
  if (!newNote) return c.json({ ok: false })

  const { results: otherNotes } = await c.env.DB.prepare(
    'SELECT id, title, summary FROM notes WHERE user_id = ? AND id != ? ORDER BY updated_at DESC LIMIT 20'
  ).bind(userId, noteId).all<{ id: string; title: string; summary: string }>()

  if (otherNotes.length === 0) return c.json({ connections: [] })

  const { model, prompts } = await getSettings(c.env.AI_SETTINGS, userId)
  const openai = getOpenAI(c.env.OPENAI_API_KEY)

  const notesList = otherNotes.map(n => `[${n.id}] ${n.title}: ${n.summary || ''}`).join('\n')
  const newNoteText = `${newNote.title}: ${newNote.summary || newNote.content?.slice(0, 500) || ''}`

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: prompts.connections },
      { role: 'user', content: `New note:\n${newNoteText}\n\nExisting notes:\n${notesList}` },
    ],
    max_tokens: 400,
    response_format: { type: 'json_object' },
  })

  let found: { noteId: string; reason: string }[] = []
  try {
    const raw = JSON.parse(completion.choices[0].message.content ?? '[]')
    found = Array.isArray(raw) ? raw : (raw.connections ?? [])
  } catch {}

  const saved: string[] = []
  for (const conn of found.slice(0, 5)) {
    const validNote = otherNotes.find(n => n.id === conn.noteId)
    if (!validNote) continue
    const id = crypto.randomUUID().replace(/-/g, '')
    await c.env.DB.prepare('INSERT INTO connections (id, user_id, note_a_id, note_b_id, reason) VALUES (?, ?, ?, ?, ?)')
      .bind(id, userId, noteId, conn.noteId, conn.reason).run()
    saved.push(id)
  }

  return c.json({ connections: saved })
})

// POST /chat — open-ended AI chat about a note or idea
app.post('/chat', async (c) => {
  const userId = c.get('userId')
  const { messages, noteId } = await c.req.json<{ messages: { role: string; content: string }[]; noteId?: string }>()
  const { model } = await getSettings(c.env.AI_SETTINGS, userId)
  const openai = getOpenAI(c.env.OPENAI_API_KEY)

  let systemPrompt = 'You are a thoughtful thinking partner helping the user develop their ideas and notes. Be concise, insightful, and ask good follow-up questions.'

  if (noteId) {
    const note = await c.env.DB.prepare('SELECT title, content, summary FROM notes WHERE id = ? AND user_id = ?').bind(noteId, userId).first<any>()
    if (note) systemPrompt += `\n\nContext note — "${note.title}": ${note.summary || note.content?.slice(0, 1000) || ''}`
  }

  const stream = await openai.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages] as any,
    max_tokens: 800,
    stream: true,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': c.req.header('Origin') ?? '*',
    },
  })
})

export default app

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwtVerify } from 'jose'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  AI_WORKER_URL: string
}

type Variables = {
  userId: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://ideavault.pages.dev', 'https://e4aef419.ideavault-47y.pages.dev', 'https://master.ideavault-47y.pages.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

// Auth middleware
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

function nanoid() { return crypto.randomUUID().replace(/-/g, '') }

// List notes
app.get('/notes', async (c) => {
  const userId = c.get('userId')
  const { tag, type, search, page = '1', limit = '20' } = c.req.query()
  const offset = (parseInt(page) - 1) * parseInt(limit)

  let query = `
    SELECT n.*, GROUP_CONCAT(t.name) as tag_names, GROUP_CONCAT(t.id) as tag_ids, GROUP_CONCAT(t.color) as tag_colors
    FROM notes n
    LEFT JOIN note_tags nt ON nt.note_id = n.id
    LEFT JOIN tags t ON t.id = nt.tag_id
    WHERE n.user_id = ?`
  const params: (string | number)[] = [userId]

  if (type) { query += ' AND n.type = ?'; params.push(type) }
  if (search) { query += ' AND (n.title LIKE ? OR n.content LIKE ? OR n.summary LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  if (tag) {
    query += ' AND n.id IN (SELECT note_id FROM note_tags nt2 JOIN tags t2 ON t2.id = nt2.tag_id WHERE t2.name = ? AND t2.user_id = ?)'
    params.push(tag, userId)
  }

  query += ' GROUP BY n.id ORDER BY n.updated_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), offset)

  const { results } = await c.env.DB.prepare(query).bind(...params).all<any>()
  const notes = results.map(formatNote)

  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').bind(userId).first<{ count: number }>()
  return c.json({ notes, total: countResult?.count ?? 0, page: parseInt(page), limit: parseInt(limit) })
})

// Get single note
app.get('/notes/:id', async (c) => {
  const userId = c.get('userId')
  const note = await c.env.DB.prepare(`
    SELECT n.*, GROUP_CONCAT(t.name) as tag_names, GROUP_CONCAT(t.id) as tag_ids, GROUP_CONCAT(t.color) as tag_colors
    FROM notes n
    LEFT JOIN note_tags nt ON nt.note_id = n.id
    LEFT JOIN tags t ON t.id = nt.tag_id
    WHERE n.id = ? AND n.user_id = ?
    GROUP BY n.id
  `).bind(c.req.param('id'), userId).first<any>()
  if (!note) return c.json({ error: 'Not found' }, 404)
  return c.json({ note: formatNote(note) })
})

// Create note
app.post('/notes', async (c) => {
  const userId = c.get('userId')
  const { title, content, type = 'manual', url, summary, tags = [] } = await c.req.json<{
    title: string; content?: string; type?: string; url?: string; summary?: string; tags?: string[]
  }>()
  if (!title) return c.json({ error: 'Title required' }, 400)

  const id = nanoid()
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare('INSERT INTO notes (id, user_id, title, content, type, url, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, title, content ?? null, type, url ?? null, summary ?? null, now, now).run()

  if (tags.length > 0) await attachTags(c.env.DB, id, userId, tags)

  // Async: find connections for this new note
  c.executionCtx?.waitUntil(
    fetch(`${c.env.AI_WORKER_URL}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal': '1', Authorization: c.req.header('Authorization') ?? '' },
      body: JSON.stringify({ noteId: id }),
    }).catch(() => {})
  )

  const note = await c.env.DB.prepare(`
    SELECT n.*, GROUP_CONCAT(t.name) as tag_names, GROUP_CONCAT(t.id) as tag_ids, GROUP_CONCAT(t.color) as tag_colors
    FROM notes n LEFT JOIN note_tags nt ON nt.note_id = n.id LEFT JOIN tags t ON t.id = nt.tag_id
    WHERE n.id = ? GROUP BY n.id
  `).bind(id).first<any>()
  return c.json({ note: formatNote(note) }, 201)
})

// Update note
app.put('/notes/:id', async (c) => {
  const userId = c.get('userId')
  const existing = await c.env.DB.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?').bind(c.req.param('id'), userId).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const { title, content, summary, tags } = await c.req.json<{ title?: string; content?: string; summary?: string; tags?: string[] }>()
  const now = Math.floor(Date.now() / 1000)
  const updates: string[] = ['updated_at = ?']
  const params: (string | number | null)[] = [now]

  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (content !== undefined) { updates.push('content = ?'); params.push(content) }
  if (summary !== undefined) { updates.push('summary = ?'); params.push(summary) }

  params.push(c.req.param('id'), userId)
  await c.env.DB.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).bind(...params).run()

  if (tags !== undefined) {
    await c.env.DB.prepare('DELETE FROM note_tags WHERE note_id = ?').bind(c.req.param('id')).run()
    if (tags.length > 0) await attachTags(c.env.DB, c.req.param('id'), userId, tags)
  }

  const note = await c.env.DB.prepare(`
    SELECT n.*, GROUP_CONCAT(t.name) as tag_names, GROUP_CONCAT(t.id) as tag_ids, GROUP_CONCAT(t.color) as tag_colors
    FROM notes n LEFT JOIN note_tags nt ON nt.note_id = n.id LEFT JOIN tags t ON t.id = nt.tag_id
    WHERE n.id = ? GROUP BY n.id
  `).bind(c.req.param('id')).first<any>()
  return c.json({ note: formatNote(note) })
})

// Delete note
app.delete('/notes/:id', async (c) => {
  const userId = c.get('userId')
  const result = await c.env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(c.req.param('id'), userId).run()
  if (!result.meta.changes) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// --- Tags ---
app.get('/tags', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name').bind(userId).all()
  return c.json({ tags: results })
})

app.post('/tags', async (c) => {
  const userId = c.get('userId')
  const { name, color = '#6b7280' } = await c.req.json<{ name: string; color?: string }>()
  if (!name) return c.json({ error: 'Name required' }, 400)
  const id = nanoid()
  await c.env.DB.prepare('INSERT OR IGNORE INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)').bind(id, userId, name.toLowerCase(), color).run()
  const tag = await c.env.DB.prepare('SELECT * FROM tags WHERE user_id = ? AND name = ?').bind(userId, name.toLowerCase()).first()
  return c.json({ tag }, 201)
})

app.delete('/tags/:id', async (c) => {
  const userId = c.get('userId')
  await c.env.DB.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').bind(c.req.param('id'), userId).run()
  return c.json({ ok: true })
})

// --- Projects ---
app.get('/projects', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all()
  return c.json({ projects: results })
})

app.get('/projects/:id', async (c) => {
  const userId = c.get('userId')
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').bind(c.req.param('id'), userId).first()
  if (!project) return c.json({ error: 'Not found' }, 404)

  const { results: notes } = await c.env.DB.prepare(`
    SELECT n.*, GROUP_CONCAT(t.name) as tag_names, GROUP_CONCAT(t.id) as tag_ids, GROUP_CONCAT(t.color) as tag_colors
    FROM notes n
    JOIN project_notes pn ON pn.note_id = n.id
    LEFT JOIN note_tags nt ON nt.note_id = n.id
    LEFT JOIN tags t ON t.id = nt.tag_id
    WHERE pn.project_id = ?
    GROUP BY n.id
  `).bind(c.req.param('id')).all<any>()

  return c.json({ project, notes: notes.map(formatNote) })
})

app.post('/projects', async (c) => {
  const userId = c.get('userId')
  const { title, description, noteIds = [] } = await c.req.json<{ title: string; description?: string; noteIds?: string[] }>()
  if (!title) return c.json({ error: 'Title required' }, 400)

  const id = nanoid()
  await c.env.DB.prepare('INSERT INTO projects (id, user_id, title, description) VALUES (?, ?, ?, ?)').bind(id, userId, title, description ?? null).run()
  for (const noteId of noteIds) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO project_notes (project_id, note_id) VALUES (?, ?)').bind(id, noteId).run()
  }
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
  return c.json({ project }, 201)
})

app.put('/projects/:id', async (c) => {
  const userId = c.get('userId')
  const { title, description, noteIds } = await c.req.json<{ title?: string; description?: string; noteIds?: string[] }>()
  const updates: string[] = []
  const params: (string | null)[] = []
  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (description !== undefined) { updates.push('description = ?'); params.push(description) }
  if (updates.length > 0) {
    params.push(c.req.param('id'), userId)
    await c.env.DB.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).bind(...params).run()
  }
  if (noteIds !== undefined) {
    await c.env.DB.prepare('DELETE FROM project_notes WHERE project_id = ?').bind(c.req.param('id')).run()
    for (const noteId of noteIds) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO project_notes (project_id, note_id) VALUES (?, ?)').bind(c.req.param('id'), noteId).run()
    }
  }
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').bind(c.req.param('id'), userId).first()
  return c.json({ project })
})

app.delete('/projects/:id', async (c) => {
  const userId = c.get('userId')
  await c.env.DB.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').bind(c.req.param('id'), userId).run()
  return c.json({ ok: true })
})

// --- Connections ---
app.get('/connections', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(`
    SELECT c.*,
      na.title as note_a_title, nb.title as note_b_title
    FROM connections c
    JOIN notes na ON na.id = c.note_a_id
    JOIN notes nb ON nb.id = c.note_b_id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
    LIMIT 50
  `).bind(userId).all()
  return c.json({ connections: results })
})

// Helpers
async function attachTags(db: D1Database, noteId: string, userId: string, tagNames: string[]) {
  for (const name of tagNames) {
    const existing = await db.prepare('SELECT id FROM tags WHERE user_id = ? AND name = ?').bind(userId, name.toLowerCase()).first<{ id: string }>()
    const tagId = existing?.id ?? crypto.randomUUID().replace(/-/g, '')
    if (!existing) await db.prepare('INSERT OR IGNORE INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)').bind(tagId, userId, name.toLowerCase(), '#6b7280').run()
    await db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').bind(noteId, tagId).run()
  }
}

function formatNote(row: any) {
  if (!row) return null
  const tagNames = row.tag_names ? row.tag_names.split(',') : []
  const tagIds = row.tag_ids ? row.tag_ids.split(',') : []
  const tagColors = row.tag_colors ? row.tag_colors.split(',') : []
  const tags = tagIds.map((id: string, i: number) => ({ id, name: tagNames[i], color: tagColors[i] })).filter((t: any) => t.id)
  const { tag_names, tag_ids, tag_colors, ...rest } = row
  return { ...rest, tags }
}

export default app

const BASE = {
  auth: import.meta.env.VITE_AUTH_URL ?? 'http://localhost:8787',
  notes: import.meta.env.VITE_NOTES_URL ?? 'http://localhost:8788',
  parser: import.meta.env.VITE_PARSER_URL ?? 'http://localhost:8789',
  ai: import.meta.env.VITE_AI_URL ?? 'http://localhost:8790',
}

function getToken() { return localStorage.getItem('token') }

async function req(base: string, path: string, init: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error ?? res.statusText)
  }
  return res.json()
}

// Auth
export const auth = {
  register: (email: string, password: string) =>
    req(BASE.auth, '/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    req(BASE.auth, '/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req(BASE.auth, '/me'),
}

// Notes
export const notes = {
  list: (params: Record<string, string> = {}) =>
    req(BASE.notes, `/notes?${new URLSearchParams(params)}`),
  get: (id: string) => req(BASE.notes, `/notes/${id}`),
  create: (data: object) => req(BASE.notes, '/notes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: object) => req(BASE.notes, `/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => req(BASE.notes, `/notes/${id}`, { method: 'DELETE' }),
}

export const tags = {
  list: () => req(BASE.notes, '/tags'),
  create: (name: string, color?: string) => req(BASE.notes, '/tags', { method: 'POST', body: JSON.stringify({ name, color }) }),
  delete: (id: string) => req(BASE.notes, `/tags/${id}`, { method: 'DELETE' }),
}

export const projects = {
  list: () => req(BASE.notes, '/projects'),
  get: (id: string) => req(BASE.notes, `/projects/${id}`),
  create: (data: object) => req(BASE.notes, '/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: object) => req(BASE.notes, `/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => req(BASE.notes, `/projects/${id}`, { method: 'DELETE' }),
}

export const connections = {
  list: () => req(BASE.notes, '/connections'),
}

// Parser
export const parser = {
  parse: (url: string) => req(BASE.parser, '/parse', { method: 'POST', body: JSON.stringify({ url }) }),
}

// AI
export const ai = {
  findConnections: (noteId: string) =>
    req(BASE.ai, '/connections', { method: 'POST', body: JSON.stringify({ noteId }) }),
  brief: () => req(BASE.ai, '/brief', { method: 'POST', body: '{}' }),
  classify: (title: string, content?: string) =>
    req(BASE.ai, '/classify', { method: 'POST', body: JSON.stringify({ title, content }) }),
  suggestions: () => req(BASE.ai, '/suggestions', { method: 'POST', body: '{}' }),
  getSettings: () => req(BASE.ai, '/settings'),
  updateSettings: (data: object) => req(BASE.ai, '/settings', { method: 'PUT', body: JSON.stringify(data) }),
  resetSettings: () => req(BASE.ai, '/settings', { method: 'DELETE' }),
  expand: async (title: string, content?: string, noteId?: string, onChunk?: (t: string) => void): Promise<string> => {
    const token = getToken()
    const res = await fetch(`${BASE.ai}/expand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ title, content, noteId }),
    })
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = dec.decode(value)
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          const chunk = JSON.parse(line.slice(6)).text
          full += chunk
          onChunk?.(chunk)
        }
      }
    }
    return full
  },
  chat: async (messages: { role: string; content: string }[], noteId?: string, onChunk?: (t: string) => void): Promise<string> => {
    const token = getToken()
    const res = await fetch(`${BASE.ai}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages, noteId }),
    })
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = dec.decode(value)
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          const chunk = JSON.parse(line.slice(6)).text
          full += chunk
          onChunk?.(chunk)
        }
      }
    }
    return full
  },
}

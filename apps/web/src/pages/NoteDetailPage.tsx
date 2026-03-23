import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Tag, Trash2, ExternalLink, Send, ChevronDown } from 'lucide-react'
import { notes as notesApi, ai } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

interface Note { id: string; title: string; content?: string; summary?: string; type: string; url?: string; created_at: number; updated_at: number; tags: { id: string; name: string; color: string }[] }

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [note, setNote] = useState<Note | null>(null)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiPanel, setAiPanel] = useState<'chat' | 'expand' | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [aiStreaming, setAiStreaming] = useState(false)
  const [expandContent, setExpandContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    notesApi.get(id).then((d: any) => {
      setNote(d.note)
      setTitle(d.note.title)
      setContent(d.note.content ?? '')
    })
  }, [id])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  async function save() {
    if (!note) return
    setSaving(true)
    try {
      const { note: updated } = await notesApi.update(note.id, { title, content }) as any
      setNote(updated)
      setEditing(false)
      toast({ title: 'Saved' })
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!note) return
    if (!confirm('Delete this note?')) return
    await notesApi.delete(note.id)
    nav('/notes')
  }

  async function getSuggestedTags() {
    if (!note) return
    const { tags } = await ai.classify(note.title, note.content ?? note.summary ?? '') as any
    setSuggestedTags(tags)
  }

  async function addTag(tagName: string) {
    if (!note) return
    const currentTags = note.tags.map(t => t.name)
    if (currentTags.includes(tagName)) return
    const { note: updated } = await notesApi.update(note.id, { tags: [...currentTags, tagName] }) as any
    setNote(updated)
    setTagInput('')
  }

  async function removeTag(tagName: string) {
    if (!note) return
    const { note: updated } = await notesApi.update(note.id, { tags: note.tags.filter(t => t.name !== tagName).map(t => t.name) }) as any
    setNote(updated)
  }

  async function sendChat() {
    if (!chatInput.trim() || aiStreaming) return
    const userMsg = { role: 'user', content: chatInput }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setAiStreaming(true)
    let reply = ''
    setChatMessages([...newMessages, { role: 'assistant', content: '' }])
    try {
      await ai.chat(newMessages, note?.id, (chunk) => {
        reply += chunk
        setChatMessages([...newMessages, { role: 'assistant', content: reply }])
      })
    } finally {
      setAiStreaming(false)
    }
  }

  async function expandIdea() {
    if (!note) return
    setExpandContent('')
    setAiPanel('expand')
    setAiStreaming(true)
    try {
      await ai.expand(note.title, note.summary || note.content || '', note.id, (chunk) => {
        setExpandContent(prev => prev + chunk)
      })
    } finally {
      setAiStreaming(false)
    }
  }

  if (!note) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="flex h-full">
      {/* Main note */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav('/notes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input value={title} onChange={e => setTitle(e.target.value)} className="h-7 text-base font-medium" autoFocus />
            ) : (
              <h1 className="text-base font-medium truncate cursor-text" onClick={() => setEditing(true)}>{note.title}</h1>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {editing ? (
              <>
                <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setTitle(note.title); setContent(note.content ?? '') }}>Cancel</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setAiPanel(aiPanel === 'chat' ? null : 'chat')}>
                  <Sparkles className="h-3.5 w-3.5" /> Chat
                </Button>
                <Button size="sm" variant="outline" onClick={expandIdea}>
                  <ChevronDown className="h-3.5 w-3.5" /> Expand
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatDate(note.created_at)}</span>
              {note.url && <a href={note.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground"><ExternalLink className="h-3 w-3" /> Source</a>}
            </div>

            {/* Summary (for link notes) */}
            {note.summary && (
              <div className="bg-secondary/50 rounded-md p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                <p className="text-sm">{note.summary}</p>
              </div>
            )}

            {/* Content */}
            {editing ? (
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm resize-none"
                placeholder="Write your note…"
              />
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap cursor-text" onClick={() => setEditing(true)}>
                {note.content || <span className="text-muted-foreground">Click to edit…</span>}
              </div>
            )}

            <Separator />

            {/* Tags */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Tags</span>
                <button onClick={getSuggestedTags} className="text-xs text-muted-foreground hover:text-foreground ml-auto">Suggest</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {note.tags.map(t => (
                  <span key={t.id} className="inline-flex items-center gap-1 text-xs bg-secondary rounded px-2 py-0.5">
                    {t.name}
                    <button onClick={() => removeTag(t.name)} className="text-muted-foreground hover:text-foreground">×</button>
                  </span>
                ))}
                <Input
                  className="h-6 w-28 text-xs px-2"
                  placeholder="Add tag…"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput.trim()) } }}
                />
              </div>
              {suggestedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestedTags.filter(t => !note.tags.find(nt => nt.name === t)).map(t => (
                    <button key={t} onClick={() => addTag(t)} className="text-xs text-muted-foreground border rounded px-2 py-0.5 hover:bg-secondary">+ {t}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* AI Panel */}
      {aiPanel && (
        <div className="w-80 border-l flex flex-col">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium">{aiPanel === 'chat' ? 'AI Chat' : 'Expand Idea'}</span>
            <button onClick={() => setAiPanel(null)} className="text-muted-foreground hover:text-foreground">×</button>
          </div>

          {aiPanel === 'chat' ? (
            <>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block max-w-[85%] rounded-md px-3 py-2 text-left ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                        {m.content || <span className="opacity-50">…</span>}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="border-t p-3 flex gap-2">
                <Input
                  placeholder="Ask about this note…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  className="text-sm"
                />
                <Button size="icon" onClick={sendChat} disabled={aiStreaming || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <ScrollArea className="flex-1 p-4">
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {expandContent || <span className="text-muted-foreground">Generating outline…</span>}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}

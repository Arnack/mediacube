import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Tag, Trash2, ExternalLink, Send, ChevronDown, GitBranch, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { notes as notesApi, ai, projects as projectsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Markdown } from '@/components/Markdown'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

interface Note { id: string; title: string; content?: string; summary?: string; type: string; url?: string; created_at: number; updated_at: number; tags: { id: string; name: string; color: string }[] }

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { t } = useTranslation()
  const [note, setNote] = useState<Note | null>(null)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiPanel, setAiPanel] = useState<'chat' | 'expand' | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [aiStreaming, setAiStreaming] = useState(false)
  const [expandContent, setExpandContent] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [sections, setSections] = useState<{ title: string; content: string; checked: boolean }[]>([])
  const [tagInput, setTagInput] = useState('')
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [findingConnections, setFindingConnections] = useState(false)
  const [backlinks, setBacklinks] = useState<{ id: string; other_id: string; other_title: string; reason: string }[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    notesApi.get(id).then((d: any) => {
      setNote(d.note)
      setTitle(d.note.title)
      setContent(d.note.content ?? '')
      setBacklinks(d.backlinks ?? [])
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
      toast({ title: t('note.saved') })
      if (content.length > 100) autoTag(note.id, updated.title, content, updated.tags.map((tg: any) => tg.name))
    } catch (err: any) {
      toast({ title: t('note.saveFailed'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function autoTag(noteId: string, noteTitle: string, noteContent: string, existing: string[]) {
    try {
      const { tags: suggested } = await ai.classify(noteTitle, noteContent) as any
      const newTags = (suggested as string[]).filter(tg => !existing.includes(tg))
      if (newTags.length > 0) {
        const { note: withTags } = await notesApi.update(noteId, { tags: [...existing, ...newTags] }) as any
        setNote(withTags)
        toast({ title: t('note.autoTagged', { tags: newTags.join(', ') }) })
      }
    } catch { /* silent */ }
  }

  async function handleDelete() {
    if (!note) return
    if (!confirm(t('note.deleteConfirm'))) return
    setDeleting(true)
    try {
      await notesApi.delete(note.id)
      nav('/notes')
    } catch (err: any) {
      toast({ title: t('note.saveFailed'), description: err.message, variant: 'destructive' })
      setDeleting(false)
    }
  }

  async function getSuggestedTags() {
    if (!note) return
    try {
      const { tags } = await ai.classify(note.title, note.content ?? note.summary ?? '') as any
      setSuggestedTags(tags)
    } catch { /* silent */ }
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
    setChatMessages([...newMessages, { role: 'assistant', content: '' }])
    setChatInput('')
    setAiStreaming(true)
    let reply = ''
    try {
      await ai.chat(newMessages, note?.id, (chunk) => {
        reply += chunk
        setChatMessages([...newMessages, { role: 'assistant', content: reply }])
      })
    } catch {
      setChatMessages(newMessages)
      toast({ title: t('note.chatFailed'), variant: 'destructive' })
    } finally {
      setAiStreaming(false)
    }
  }

  function parseOutlineSections(text: string): { title: string; content: string; checked: boolean }[] {
    const headerRe = /^(#{1,3}\s+(.+)|(\d+)\.\s+\*{0,2}(.+?)\*{0,2})\s*$/
    const lines = text.split('\n')
    const result: { title: string; content: string; checked: boolean }[] = []
    let current: { title: string; lines: string[] } | null = null
    for (const line of lines) {
      const m = line.match(headerRe)
      if (m) {
        if (current) result.push({ title: current.title, content: current.lines.join('\n').trim(), checked: true })
        current = { title: (m[2] ?? m[4] ?? m[1]).replace(/\*\*/g, '').trim(), lines: [] }
      } else if (current) {
        current.lines.push(line)
      }
    }
    if (current) result.push({ title: current.title, content: current.lines.join('\n').trim(), checked: true })
    return result
  }

  async function expandIdea() {
    if (!note) return
    setExpandContent('')
    setSections([])
    setProjectTitle(note.title)
    setAiPanel('expand')
    setAiStreaming(true)
    let full = ''
    try {
      await ai.expand(note.title, note.summary || note.content || '', note.id, (chunk) => {
        full += chunk
        setExpandContent(prev => prev + chunk)
      })
      setSections(parseOutlineSections(full))
    } catch {
      setExpandContent('')
      toast({ title: t('note.expandFailed'), variant: 'destructive' })
    } finally {
      setAiStreaming(false)
    }
  }

  async function saveAsProject() {
    if (!note || !projectTitle.trim()) return
    setSavingProject(true)
    try {
      const { project } = await projectsApi.create({ title: projectTitle.trim(), description: expandContent.slice(0, 500) }) as any
      const checkedSections = sections.filter(s => s.checked)
      const stubNotes = await Promise.all(
        checkedSections.map(s => notesApi.create({ title: s.title, content: s.content }) as Promise<any>)
      )
      const stubIds = stubNotes.map(r => r.note.id)
      await projectsApi.update(project.id, { noteIds: [note.id, ...stubIds] })
      setAiPanel(null)
      nav(`/projects/${project.id}`)
    } catch (err: any) {
      toast({ title: t('projects.failed'), description: err.message, variant: 'destructive' })
    } finally {
      setSavingProject(false)
    }
  }

  async function handleFindConnections() {
    if (!note) return
    setFindingConnections(true)
    try {
      await ai.findConnections(note.id)
      // Refresh backlinks after finding new connections
      const d: any = await notesApi.get(note.id)
      setBacklinks(d.backlinks ?? [])
      toast({ title: t('note.findConnections') })
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setFindingConnections(false)
    }
  }

  function handleExport() {
    if (!note) return
    const tags = note.tags.map((t: any) => t.name)
    const date = new Date(note.created_at * 1000).toISOString().slice(0, 10)
    const front = [
      '---',
      `title: "${note.title.replace(/"/g, '\\"')}"`,
      tags.length ? `tags: [${tags.map((t: string) => `"${t}"`).join(', ')}]` : null,
      note.url ? `url: ${note.url}` : null,
      `created: ${date}`,
      '---',
      '',
    ].filter(l => l !== null).join('\n')
    const body = note.content ? `# ${note.title}\n\n${note.content}` : `# ${note.title}`
    const blob = new Blob([front + body], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!note) return <div className="p-4 text-sm text-muted-foreground">{t('common.loading')}</div>

  return (
    <div className="flex h-full">
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
                <Button size="sm" onClick={save} disabled={saving}>{saving ? t('notes.saving') : t('notes.save')}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setTitle(note.title); setContent(note.content ?? '') }}>{t('note.cancel')}</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setAiPanel(aiPanel === 'chat' ? null : 'chat')}>
                  <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t('note.chat')}</span>
                </Button>
                <Button size="sm" variant="outline" onClick={expandIdea}>
                  <ChevronDown className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t('note.expand')}</span>
                </Button>
                <Button size="sm" variant="outline" onClick={handleFindConnections} disabled={findingConnections}>
                  <GitBranch className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{findingConnections ? t('note.findingConnections') : t('note.findConnections')}</span>
                </Button>
                <Button size="sm" variant="outline" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t('note.export')}</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleting}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatDate(note.created_at)}</span>
              {note.url && <a href={note.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground"><ExternalLink className="h-3 w-3" /> {t('note.source')}</a>}
            </div>

            {note.summary && (
              <div className="bg-secondary/50 rounded-md p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('note.summary')}</p>
                <div className="text-sm"><Markdown>{note.summary}</Markdown></div>
              </div>
            )}

            {editing ? (
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm resize-none"
                placeholder={t('note.writePlaceholder')}
              />
            ) : (
              <div className="cursor-text" onClick={() => setEditing(true)}>
                {note.content
                  ? <Markdown>{note.content}</Markdown>
                  : <span className="text-sm text-muted-foreground">{t('note.clickToEdit')}</span>}
              </div>
            )}

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{t('note.tags')}</span>
                <button onClick={getSuggestedTags} className="text-xs text-muted-foreground hover:text-foreground ml-auto">{t('note.suggest')}</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {note.tags.map(tag => (
                  <span key={tag.id} className="inline-flex items-center gap-1 text-xs bg-secondary rounded px-2 py-0.5">
                    {tag.name}
                    <button onClick={() => removeTag(tag.name)} className="text-muted-foreground hover:text-foreground">×</button>
                  </span>
                ))}
                <Input
                  className="h-6 w-28 text-xs px-2"
                  placeholder={t('note.addTag')}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput.trim()) } }}
                />
              </div>
              {suggestedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestedTags.filter(tag => !note.tags.find(nt => nt.name === tag)).map(tag => (
                    <button key={tag} onClick={() => addTag(tag)} className="text-xs text-muted-foreground border rounded px-2 py-0.5 hover:bg-secondary">+ {tag}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{t('note.related')}</span>
            </div>
            {backlinks.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('note.relatedEmpty')}</p>
            ) : (
              <div className="space-y-1.5">
                {backlinks.map(bl => (
                  <button
                    key={bl.id}
                    onClick={() => nav(`/notes/${bl.other_id}`)}
                    className="w-full text-left border rounded-md px-3 py-2 hover:bg-secondary/30 group"
                  >
                    <p className="text-xs font-medium">{bl.other_title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{bl.reason}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {aiPanel && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:relative md:inset-auto md:z-auto md:w-80 md:border-l">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium">{aiPanel === 'chat' ? t('note.aiChat') : t('note.expandIdea')}</span>
            <button onClick={() => setAiPanel(null)} className="text-muted-foreground hover:text-foreground">×</button>
          </div>

          {aiPanel === 'chat' ? (
            <>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block max-w-[85%] rounded-md px-3 py-2 text-left ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                        {m.content
                          ? (m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : m.content)
                          : <span className="opacity-50">…</span>}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="border-t p-3 flex gap-2">
                <Input
                  placeholder={t('note.chatPlaceholder')}
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
            <>
              <ScrollArea className="flex-1 p-4">
                {expandContent
                  ? <Markdown>{expandContent}</Markdown>
                  : <span className="text-sm text-muted-foreground">{t('note.generatingOutline')}</span>}
              </ScrollArea>
              {!aiStreaming && expandContent && (
                <div className="border-t p-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t('note.projectTitleLabel')}</p>
                    <Input value={projectTitle} onChange={e => setProjectTitle(e.target.value)} className="h-8 text-sm" />
                  </div>
                  {sections.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('note.noteSections')}</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {sections.map((s, i) => (
                          <label key={i} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={s.checked}
                              onChange={() => setSections(prev => prev.map((x, j) => j === i ? { ...x, checked: !x.checked } : x))}
                            />
                            <span className="truncate">{s.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button size="sm" className="w-full" onClick={saveAsProject} disabled={savingProject || !projectTitle.trim()}>
                    {savingProject ? t('note.creatingProject') : t('note.saveAsProject')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

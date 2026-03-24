import { useState, useEffect, useCallback } from 'react'
import JSZip from 'jszip'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Link as LinkIcon, FileText, Sparkles, X, Archive, Loader2, ArrowDownWideNarrow, ArrowUpWideNarrow, ArrowUpAZ } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { notes as notesApi, tags as tagsApi, ai, parser } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatRelative } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

interface Note { id: string; title: string; content?: string; summary?: string; type: string; url?: string; updated_at: number; tags: { id: string; name: string; color: string }[] }
interface Tag { id: string; name: string; color: string }

export function NotesPage() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [notesList, setNotesList] = useState<Note[]>([])
  const [tagsList, setTagsList] = useState<Tag[]>([])
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [activeTag, setActiveTag] = useState(params.get('tag') ?? '')
  const [loading, setLoading] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<{ title: string; description: string }[]>([])
  const [sort, setSort] = useState<'newest' | 'oldest' | 'az'>('newest')
  const [exportingAll, setExportingAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = {}
      if (search) p.search = search
      if (activeTag) p.tag = activeTag
      const { notes } = await notesApi.list(p) as any
      setNotesList(notes)
    } finally {
      setLoading(false)
    }
  }, [search, activeTag])

  useEffect(() => { load() }, [load])
  useEffect(() => { tagsApi.list().then((d: any) => setTagsList(d.tags)) }, [])

  useEffect(() => {
    const p: Record<string, string> = {}
    if (search) p.q = search
    if (activeTag) p.tag = activeTag
    setParams(p, { replace: true })
  }, [search, activeTag])

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!urlInput.trim()) return
    setAddingUrl(true)
    try {
      const { note } = await parser.parse(urlInput) as any
      setUrlInput('')
      toast({ title: t('notes.articleSaved'), description: note.title })
      load()
    } catch (err: any) {
      toast({ title: t('notes.failedParseUrl'), description: err.message, variant: 'destructive' })
    } finally {
      setAddingUrl(false)
    }
  }

  async function handleExportAll() {
    setExportingAll(true)
    try {
      const { notes: all } = await notesApi.list({ limit: '1000' }) as any
      const zip = new JSZip()
      for (const note of all) {
        const tags = (note.tags ?? []).map((t: any) => t.name)
        const frontmatter = [
          '---',
          `title: "${note.title.replace(/"/g, '\\"')}"`,
          tags.length ? `tags: [${tags.join(', ')}]` : null,
          note.url ? `url: ${note.url}` : null,
          `created: ${new Date(note.created_at * 1000).toISOString().slice(0, 10)}`,
          '---',
        ].filter(Boolean).join('\n')
        const body = [frontmatter, '', `# ${note.title}`, '', note.content ?? note.summary ?? ''].join('\n')
        const filename = note.title.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80) + '.md'
        zip.file(filename, body)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `ideavault-export-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err: any) {
      toast({ title: t('notes.exportAll'), description: err.message, variant: 'destructive' })
    } finally {
      setExportingAll(false)
    }
  }

  async function loadSuggestions() {
    setShowSuggestions(true)
    try {
      const { suggestions: s } = await ai.suggestions() as any
      setSuggestions(s)
    } catch {
      setSuggestions([])
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b px-4 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('notes.search')}
              className="pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" onClick={() => nav('/notes/new')}>
            <Plus className="h-4 w-4" />
            {t('notes.new')}
          </Button>
          {/* Sort — desktop: 3-button group */}
          <div className="hidden sm:flex border rounded-md overflow-hidden text-xs">
            {(['newest', 'oldest', 'az'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-2 py-1.5 ${sort === s ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t(`notes.sort${s === 'az' ? 'AZ' : s.charAt(0).toUpperCase() + s.slice(1)}`)}
              </button>
            ))}
          </div>
          {/* Sort — mobile: single cycling button */}
          <Button
            size="sm"
            variant="outline"
            className="sm:hidden h-9 w-9 p-0"
            onClick={() => setSort(s => s === 'newest' ? 'oldest' : s === 'oldest' ? 'az' : 'newest')}
            title={t(`notes.sort${sort === 'az' ? 'AZ' : sort.charAt(0).toUpperCase() + sort.slice(1)}`)}
          >
            {sort === 'newest' && <ArrowDownWideNarrow className="h-4 w-4" />}
            {sort === 'oldest' && <ArrowUpWideNarrow className="h-4 w-4" />}
            {sort === 'az' && <ArrowUpAZ className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={loadSuggestions}>
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportAll} disabled={exportingAll}>
            <Archive className="h-4 w-4" />
          </Button>
        </div>

        <div className="border-b">
          <form onSubmit={handleAddUrl} className="px-4 py-2 flex gap-2">
            <div className="relative flex-1">
              {addingUrl
                ? <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-spin" />
                : <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />}
              <Input
                placeholder={t('notes.pasteUrl')}
                className="pl-8 h-8 text-sm"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                disabled={addingUrl}
              />
            </div>
            <Button type="submit" size="sm" disabled={addingUrl || !urlInput.trim()} className="h-8 min-w-[90px]">
              {addingUrl ? t('notes.importingUrl') : t('notes.importUrl')}
            </Button>
          </form>
          {addingUrl && (
            <div className="h-0.5 bg-primary/15 overflow-hidden">
              <div className="h-full w-1/4 bg-primary rounded-full animate-indeterminate" />
            </div>
          )}
        </div>

        {tagsList.length > 0 && (
          <div className="border-b px-4 py-2 flex gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTag('')}
              className={`text-xs px-2 py-0.5 rounded-md transition-colors ${activeTag === '' ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('notes.all')}
            </button>
            {tagsList.map(tag => (
              <button
                key={tag.id}
                onClick={() => setActiveTag(activeTag === tag.name ? '' : tag.name)}
                className={`text-xs px-2 py-0.5 rounded-md transition-colors ${activeTag === tag.name ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="divide-y">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">{t('notes.loading')}</div>
            ) : notesList.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{t('notes.empty')}</p>
                <Button size="sm" className="mt-3" onClick={() => nav('/notes/new')}>{t('notes.createFirst')}</Button>
              </div>
            ) : (
              [...notesList].sort((a, b) =>
                sort === 'newest' ? b.updated_at - a.updated_at :
                sort === 'oldest' ? a.updated_at - b.updated_at :
                a.title.localeCompare(b.title)
              ).map(note => (
                <button
                  key={note.id}
                  onClick={() => nav(`/notes/${note.id}`)}
                  className="w-full max-w-[100vw] md:max-w-[calc(100vw-210px)] text-left px-4 py-3 hover:bg-accent/30 transition-colors card-hover"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {note.type === 'link'
                        ? <LinkIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground mt-0.5" />
                        : <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground mt-0.5" />}
                      <span className="text-sm font-medium truncate">{note.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatRelative(note.updated_at)}</span>
                  </div>
                  {note.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-1 pl-5">{note.summary}</p>}
                  {note.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 pl-5 flex-wrap">
                      {note.tags.map(t => (
                        <span key={t.id} className="text-xs text-muted-foreground">{t.name}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {showSuggestions && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:relative md:inset-auto md:z-auto md:w-72 md:border-l">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {t('notes.aiSuggestions')}</span>
            <button onClick={() => setShowSuggestions(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('notes.loadingSuggestions')}</p>
              ) : suggestions.map((s, i) => (
                <div key={i} className="p-3 rounded-md border hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => nav('/notes/new', { state: { title: s.title, content: s.description } })}>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

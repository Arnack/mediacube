import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Sparkles, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { notes as notesApi, ai } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/hooks/useToast'

interface Suggestion { title: string; description: string }

export function NewNotePage() {
  const nav = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const state = location.state as { title?: string; content?: string } | null
  const [title, setTitle] = useState(state?.title ?? '')
  const [content, setContent] = useState(state?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadSuggestions(true) }, [])

  async function loadSuggestions(initial = false) {
    if (initial) setLoadingSuggestions(true)
    else setRefreshing(true)
    try {
      const { suggestions: s } = await ai.suggestions(i18n.language) as any
      setSuggestions(s ?? [])
    } catch {
      if (initial) setSuggestions([])
    } finally {
      setLoadingSuggestions(false)
      setRefreshing(false)
    }
  }

  function applySuggestion(s: Suggestion) {
    setTitle(s.title)
    setContent(s.description)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const { note } = await notesApi.create({ title: title.trim(), content: content.trim() }) as any
      if (content.trim().length > 100) {
        try {
          const { tags: suggested } = await ai.classify(title.trim(), content.trim()) as any
          if (suggested?.length > 0) await notesApi.update(note.id, { tags: suggested })
        } catch { /* silent */ }
      }
      nav(`/notes/${note.id}`, { replace: true })
    } catch (err: any) {
      toast({ title: t('notes.failedCreate'), description: err.message, variant: 'destructive' })
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav('/notes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{t('notes.newNote')}</span>
          <div className="flex-1" />
          <Button size="sm" onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? t('notes.saving') : t('notes.save')}
          </Button>
        </div>
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-3">
          <Input
            placeholder={t('notes.title')}
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-lg font-medium border-none shadow-none px-0 focus-visible:ring-0 h-auto py-0"
            autoFocus
          />
          <Textarea
            placeholder={t('notes.startWriting')}
            value={content}
            onChange={e => setContent(e.target.value)}
            className="min-h-[400px] font-mono text-sm resize-none border-none shadow-none px-0 focus-visible:ring-0"
          />
        </div>
      </div>

      {/* AI suggestions panel */}
      <aside className="hidden md:flex w-72 flex-shrink-0 border-l flex-col">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t('notes.aiSuggestions')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => loadSuggestions(false)}
            disabled={loadingSuggestions || refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {loadingSuggestions ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2 animate-pulse">
                    <div className="h-3.5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">{t('notes.aiSuggestions')} — {t('notes.empty')}</p>
            ) : (
              suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => applySuggestion(s)}
                  className="w-full text-left rounded-lg border p-3 hover:bg-accent/50 hover:border-primary/30 transition-colors group"
                >
                  <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
                    {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {s.description}
                  </p>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="border-t px-4 py-2">
          <p className="text-[10px] text-muted-foreground">{t('notes.suggestionsHint')}</p>
        </div>
      </aside>
    </div>
  )
}

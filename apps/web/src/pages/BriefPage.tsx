import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, RefreshCw, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ai, notes as notesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface Brief {
  threads: { title: string; insight: string }[]
  focus: string | null
  prompt: string | null
}

export function BriefPage() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setBrief(null)
    try {
      const [b, nd] = await Promise.all([
        ai.brief() as Promise<any>,
        notesApi.list({ limit: '30' }) as Promise<any>,
      ])
      setBrief(b)
      if (b.focus) {
        const match = nd.notes.find((n: any) =>
          n.title.toLowerCase() === b.focus?.toLowerCase()
        )
        setFocusNoteId(match?.id ?? null)
      }
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> {t('brief.title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t('brief.subtitle')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('brief.refresh')}</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('brief.loading')}</p>
          ) : !brief || (!brief.threads?.length && !brief.focus && !brief.prompt) ? (
            <p className="text-sm text-muted-foreground">{t('brief.empty')}</p>
          ) : (
            <>
              {brief.threads?.length > 0 && (
                <div>
                  <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('brief.themes')}</h2>
                  <div className="space-y-3">
                    {brief.threads.map((thread, i) => (
                      <div key={i} className="border rounded-md p-3">
                        <p className="text-sm font-medium">{thread.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{thread.insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {brief.focus && (
                <>
                  <Separator />
                  <div>
                    <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('brief.focus')}</h2>
                    <div className="border rounded-md p-3 flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{brief.focus}</p>
                      {focusNoteId && (
                        <Button size="sm" variant="ghost" onClick={() => nav(`/notes/${focusNoteId}`)} className="flex-shrink-0">
                          <ArrowRight className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t('brief.goToNote')}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {brief.prompt && (
                <>
                  <Separator />
                  <div>
                    <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('brief.prompt')}</h2>
                    <div className="border rounded-md p-3">
                      <p className="text-sm italic text-muted-foreground">{brief.prompt}</p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

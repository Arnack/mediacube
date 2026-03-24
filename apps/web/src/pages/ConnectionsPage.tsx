import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { connections } from '@/lib/api'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatRelative } from '@/lib/utils'

interface Connection { id: string; note_a_id: string; note_b_id: string; note_a_title: string; note_b_title: string; reason: string; created_at: number }

export function ConnectionsPage() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const [list, setList] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    connections.list().then((d: any) => setList(d.connections)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3">
        <h1 className="text-base font-medium flex items-center gap-2">
          <GitBranch className="h-4 w-4" /> {t('connections.title')}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t('connections.subtitle')}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-2xl space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('connections.loading')}</p>
          ) : list.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t('connections.empty')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('connections.emptyDetail')}</p>
            </div>
          ) : list.map(conn => (
            <div key={conn.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <button onClick={() => nav(`/notes/${conn.note_a_id}`)} className="font-medium hover:underline truncate max-w-[40%]">{conn.note_a_title}</button>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <button onClick={() => nav(`/notes/${conn.note_b_id}`)} className="font-medium hover:underline truncate max-w-[40%]">{conn.note_b_title}</button>
              </div>
              <p className="text-xs text-muted-foreground">{conn.reason}</p>
              <p className="text-xs text-muted-foreground/60">{formatRelative(conn.created_at)}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

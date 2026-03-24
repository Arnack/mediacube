import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { projects as projectsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

interface Project { id: string; title: string; description?: string; created_at: number }

export function ProjectsPage() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const [projectsList, setProjectsList] = useState<Project[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    projectsApi.list().then((d: any) => setProjectsList(d.projects))
  }, [])

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const { project } = await projectsApi.create({ title: newTitle, description: newDesc }) as any
      setProjectsList(p => [project, ...p])
      setNewTitle('')
      setNewDesc('')
      setShowNew(false)
      nav(`/projects/${project.id}`)
    } catch (err: any) {
      toast({ title: t('projects.failed'), description: err.message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <span className="text-base font-medium">{t('projects.title')}</span>
        <Button size="sm" onClick={() => setShowNew(!showNew)}>
          <Plus className="h-4 w-4" /> {t('projects.new')}
        </Button>
      </div>

      {showNew && (
        <form onSubmit={createProject} className="border-b px-4 py-3 space-y-2">
          <Input placeholder={t('projects.projectName')} value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
          <Input placeholder={t('projects.description')} value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={creating || !newTitle.trim()}>{creating ? t('projects.creating') : t('projects.create')}</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setShowNew(false)}>{t('projects.cancel')}</Button>
          </div>
        </form>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projectsList.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Folder className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t('projects.empty')}</p>
            </div>
          ) : projectsList.map(p => (
            <button
              key={p.id}
              onClick={() => nav(`/projects/${p.id}`)}
              className="text-left p-4 rounded-lg border hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <Folder className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">{formatDate(p.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

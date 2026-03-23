import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, FileText, Plus } from 'lucide-react'
import { projects as projectsApi, notes as notesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { formatRelative } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

interface Note { id: string; title: string; summary?: string; updated_at: number; tags: any[] }
interface Project { id: string; title: string; description?: string }

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [projectNotes, setProjectNotes] = useState<Note[]>([])
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteSearch, setNoteSearch] = useState('')

  useEffect(() => {
    if (!id) return
    projectsApi.get(id).then((d: any) => {
      setProject(d.project)
      setProjectNotes(d.notes)
    })
    notesApi.list().then((d: any) => setAllNotes(d.notes))
  }, [id])

  async function addNote(noteId: string) {
    if (!project || !id) return
    const currentIds = projectNotes.map(n => n.id)
    if (currentIds.includes(noteId)) return
    await projectsApi.update(id, { noteIds: [...currentIds, noteId] })
    const note = allNotes.find(n => n.id === noteId)
    if (note) setProjectNotes(prev => [...prev, note])
    setShowAddNote(false)
  }

  async function removeNote(noteId: string) {
    if (!id) return
    const newIds = projectNotes.filter(n => n.id !== noteId).map(n => n.id)
    await projectsApi.update(id, { noteIds: newIds })
    setProjectNotes(prev => prev.filter(n => n.id !== noteId))
  }

  async function deleteProject() {
    if (!id || !confirm('Delete this project?')) return
    await projectsApi.delete(id)
    nav('/projects')
  }

  const available = allNotes.filter(n =>
    !projectNotes.find(pn => pn.id === n.id) &&
    (!noteSearch || n.title.toLowerCase().includes(noteSearch.toLowerCase()))
  )

  if (!project) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav('/projects')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-medium">{project.title}</h1>
          {project.description && <p className="text-xs text-muted-foreground">{project.description}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAddNote(!showAddNote)}>
          <Plus className="h-3.5 w-3.5" /> Add note
        </Button>
        <Button size="icon" variant="ghost" onClick={deleteProject}>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-2xl space-y-2">
            {projectNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes in this project yet.</p>
            ) : projectNotes.map(note => (
              <div key={note.id} className="flex items-start gap-3 p-3 rounded-md border hover:bg-secondary/20 group">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => nav(`/notes/${note.id}`)}>
                  <p className="text-sm font-medium">{note.title}</p>
                  {note.summary && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{note.summary}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{formatRelative(note.updated_at)}</span>
                <button onClick={() => removeNote(note.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground">×</button>
              </div>
            ))}
          </div>
        </ScrollArea>

        {showAddNote && (
          <div className="w-72 border-l flex flex-col">
            <div className="border-b px-3 py-2">
              <Input placeholder="Search notes…" value={noteSearch} onChange={e => setNoteSearch(e.target.value)} className="h-8 text-sm" autoFocus />
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {available.map(note => (
                  <button key={note.id} onClick={() => addNote(note.id)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary/50 truncate">
                    {note.title}
                  </button>
                ))}
                {available.length === 0 && <p className="text-xs text-muted-foreground p-2">No notes found</p>}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}

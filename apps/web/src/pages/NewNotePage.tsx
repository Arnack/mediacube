import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { notes as notesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/useToast'

export function NewNotePage() {
  const nav = useNavigate()
  const location = useLocation()
  const state = location.state as { title?: string; content?: string } | null
  const [title, setTitle] = useState(state?.title ?? '')
  const [content, setContent] = useState(state?.content ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const { note } = await notesApi.create({ title: title.trim(), content: content.trim() }) as any
      nav(`/notes/${note.id}`, { replace: true })
    } catch (err: any) {
      toast({ title: 'Failed to create note', description: err.message, variant: 'destructive' })
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav('/notes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">New note</span>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSubmit} disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-3">
        <Input
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-lg font-medium border-none shadow-none px-0 focus-visible:ring-0 h-auto py-0"
          autoFocus
        />
        <Textarea
          placeholder="Start writing…"
          value={content}
          onChange={e => setContent(e.target.value)}
          className="min-h-[400px] font-mono text-sm resize-none border-none shadow-none px-0 focus-visible:ring-0"
        />
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { notes as notesApi, connections as connectionsApi } from '@/lib/api'
import ForceGraph2D from 'react-force-graph-2d'

interface NoteNode { id: string; name: string; val: number; x?: number; y?: number }
interface ConnLink { source: string; target: string; reason: string }

export function GraphPage() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [graphData, setGraphData] = useState<{ nodes: NoteNode[]; links: ConnLink[] }>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      notesApi.list({ limit: '500' }) as Promise<any>,
      connectionsApi.list() as Promise<any>,
    ]).then(([nd, cd]) => {
      const notes: any[] = nd.notes
      const conns: any[] = cd.connections
      const degree: Record<string, number> = {}
      conns.forEach(c => {
        degree[c.note_a_id] = (degree[c.note_a_id] ?? 0) + 1
        degree[c.note_b_id] = (degree[c.note_b_id] ?? 0) + 1
      })
      setGraphData({
        nodes: notes.map(n => ({ id: n.id, name: n.title, val: 1 + (degree[n.id] ?? 0) })),
        links: conns.map(c => ({ source: c.note_a_id, target: c.note_b_id, reason: c.reason })),
      })
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setDims({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [loading])

  const handleClick = useCallback((node: any) => nav(`/notes/${node.id}`), [nav])

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const r = Math.sqrt(node.val) * 3
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = 'hsl(215, 20%, 55%)'
    ctx.fill()
    if (scale > 1.5) {
      const label = node.name.length > 24 ? node.name.slice(0, 24) + '…' : node.name
      const fontSize = Math.min(12 / scale, 10)
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = 'hsl(215, 16%, 40%)'
      ctx.fillText(label, node.x, node.y + r + 1)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3">
        <h1 className="text-base font-medium flex items-center gap-2">
          <Network className="h-4 w-4" /> {t('graph.title')}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {loading ? t('common.loading') : graphData.links.length === 0 ? t('graph.empty') : t('graph.clickToOpen')}
        </p>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {!loading && graphData.links.length > 0 && (
          <ForceGraph2D
            graphData={graphData}
            width={dims.w}
            height={dims.h}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            linkColor={() => 'rgba(156,163,175,0.35)'}
            linkLabel="reason"
            onNodeClick={handleClick}
            backgroundColor="transparent"
            cooldownTicks={120}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              const r = Math.sqrt(node.val) * 3
              ctx.beginPath()
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
              ctx.fillStyle = color
              ctx.fill()
            }}
          />
        )}
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { Crown, ArrowRight } from 'lucide-react'
import { Button } from './ui/button'

interface Props {
  title?: string
  message?: string
  compact?: boolean
}

export function UpgradeBanner({ title = 'Pro Feature', message = 'Upgrade to Pro to unlock this feature.', compact = false }: Props) {
  const nav = useNavigate()

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
        <Crown className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs text-foreground flex-1">{message}</span>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-primary hover:text-primary/80" onClick={() => nav('/pricing')}>
          Upgrade <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <Crown className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{message}</p>
      <Button
        onClick={() => nav('/pricing')}
        className="w-full sm:w-auto"
      >
        <Crown className="h-4 w-4 mr-2" />
        Upgrade to Pro
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  )
}

import { Check, Crown, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useSubscription } from '@/hooks/useSubscription'

const features = [
  { name: 'Notes', free: 'Up to 10', pro: 'Unlimited' },
  { name: 'AI features (daily)', free: 'Up to 10', pro: 'Unlimited' },
  { name: 'URL parsing (daily)', free: 'Up to 5', pro: 'Unlimited' },
  { name: 'Knowledge Graph', free: '—', pro: true },
  { name: 'Connections', free: '—', pro: true },
  { name: 'Export notes', free: '—', pro: true },
  { name: 'Priority support', free: '—', pro: true },
]

export function PricingPage() {
  const nav = useNavigate()
  const { isPro, checkout } = useSubscription()

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Choose your plan
          </h1>
          <p className="mt-2 text-muted-foreground">
            Unlock the full power of IdeaVault
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Free Plan */}
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Free</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Get started with the basics</p>
            <div className="mb-6">
              <span className="text-3xl font-bold">$0</span>
              <span className="text-sm text-muted-foreground"> / month</span>
            </div>

            <ul className="space-y-2.5 flex-1">
              {features.map(f => (
                <li key={f.name} className="flex items-center gap-2 text-sm">
                  {f.free === '—' ? (
                    <span className="h-4 w-4 flex items-center justify-center text-muted-foreground/40">—</span>
                  ) : (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  )}
                  <span className={f.free === '—' ? 'text-muted-foreground/60' : 'text-foreground'}>
                    {f.name}
                    {f.free !== '—' ? <span className="text-muted-foreground"> · {f.free as string}</span> : ''}
                  </span>
                </li>
              ))}
            </ul>

            <Button variant="outline" className="mt-6 w-full" disabled>
              Current plan
            </Button>
          </div>

          {/* Pro Plan */}
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-6 flex flex-col relative overflow-hidden">
            {/* Badge */}
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide">
              Popular
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Pro</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">For power users and teams</p>
            <div className="mb-6">
              <span className="text-3xl font-bold">$4.88</span>
              <span className="text-sm text-muted-foreground"> / month</span>
            </div>

            <ul className="space-y-2.5 flex-1">
              {features.map(f => (
                <li key={f.name} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-foreground">
                    {f.name}
                    {typeof f.pro === 'string' ? <span className="text-muted-foreground"> · {f.pro}</span> : ''}
                  </span>
                </li>
              ))}
            </ul>

            {isPro ? (
              <Button variant="outline" className="mt-6 w-full" disabled>
                <Crown className="h-4 w-4 mr-2 text-primary" />
                You're on Pro
              </Button>
            ) : (
              <Button
                className="mt-6 w-full"
                onClick={checkout}
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Secure payment via Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { auth as authApi } from '@/lib/api'
import { setAuth } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

export function RegisterPage() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { token, user } = await authApi.register(email, password) as any
      setAuth(user, token)
      nav('/notes')
    } catch (err: any) {
      toast({ title: t('auth.registerFailed'), description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-50 pointer-events-none" />
      <div className="w-full max-w-sm space-y-6 px-4 relative z-10">
        <div className="text-center space-y-2 mb-8 mt-2">
          <h1 className="text-4xl font-black tracking-tighter text-foreground">
            {t('app.name')}
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Create an account to unlock your creative space.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-4 shadow-xl shadow-black/5">
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5 flex flex-col text-left">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-9 h-11 bg-muted/40 focus:bg-background transition-colors" required autoFocus />
              </div>
            </div>
            <div className="space-y-1.5 flex flex-col text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('auth.passwordHint', 'Password (min 8)')}</label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-9 pr-10 h-11 bg-muted/40 focus:bg-background transition-colors" required minLength={8} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors p-1" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11 font-medium mt-6" disabled={loading}>
              {loading ? t('auth.registeringButton') : t('auth.registerButton')}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">{t('auth.signIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

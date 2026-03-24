import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">{t('app.name')}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t('auth.registerTitle')}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input type="email" placeholder={t('auth.email')} value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <Input type="password" placeholder={t('auth.passwordHint')} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            <Button type="submit" className="w-full" disabled={loading}>
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

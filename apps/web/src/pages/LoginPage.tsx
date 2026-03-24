import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { auth as authApi } from '@/lib/api'
import { setAuth } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { Sun, Moon } from 'lucide-react'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'zh', label: '中' },
]

export function LoginPage() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const { theme, toggle } = useTheme()

  function switchLang(code: string) {
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
  }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { token, user } = await authApi.login(email, password) as any
      setAuth(user, token)
      nav('/notes')
    } catch (err: any) {
      toast({ title: t('auth.loginFailed'), description: err.message, variant: 'destructive' })
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
          <p className="text-sm text-muted-foreground">{t('auth.signInTitle')}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input type="email" placeholder={t('auth.email')} value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <Input type="password" placeholder={t('auth.password')} value={password} onChange={e => setPassword(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">{t('auth.register')}</Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
        <div className="flex gap-0.5 bg-secondary/50 rounded-md p-0.5 flex-1">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => switchLang(l.code)}
              className={cn(
                'flex-1 text-xs py-1 rounded transition-all duration-150',
                i18n.language === l.code
                  ? 'bg-primary/15 text-primary font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        </div>
      </div>
    </div>
  )
}

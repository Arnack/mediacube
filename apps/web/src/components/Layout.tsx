import { NavLink, useNavigate } from 'react-router-dom'
import { FileText, Folder, GitBranch, Settings, LogOut } from 'lucide-react'
import { logout } from '@/store/auth'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { useTranslation } from 'react-i18next'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'zh', label: '中' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const navItems = [
    { to: '/notes', icon: FileText, label: t('nav.notes') },
    { to: '/projects', icon: Folder, label: t('nav.projects') },
    { to: '/connections', icon: GitBranch, label: t('nav.connections') },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
  ]

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function switchLang(code: string) {
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
  }

  return (
    <div className="flex h-screen bg-background">

      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-48 flex-shrink-0 border-r flex-col">
        <div className="px-4 py-3 border-b">
          <span className="font-semibold text-sm tracking-tight">{t('app.name')}</span>
        </div>
        <nav className="flex-1 p-2 space-y-px">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-3 py-2 rounded text-sm',
                isActive
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t space-y-1">
          <div className="flex gap-px px-1 mb-1">
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => switchLang(l.code)}
                className={cn(
                  'flex-1 text-xs py-1 rounded',
                  i18n.language === l.code
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {t('auth.signOut')}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col pb-14 md:pb-0">
        {children}
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-14 border-t bg-background flex z-30">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight',
              isActive ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

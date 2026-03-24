import { NavLink, useNavigate } from 'react-router-dom'
import { FileText, Folder, GitBranch, Settings, LogOut, Network, Lightbulb, Sun, Moon, Zap } from 'lucide-react'
import { logout } from '@/store/auth'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'zh', label: '中' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { theme, toggle } = useTheme()

  const navItems = [
    { to: '/notes', icon: FileText, label: t('nav.notes') },
    { to: '/projects', icon: Folder, label: t('nav.projects') },
    { to: '/connections', icon: GitBranch, label: t('nav.connections') },
    { to: '/graph', icon: Network, label: t('nav.graph') },
    { to: '/brief', icon: Lightbulb, label: t('nav.brief') },
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
      <aside className="hidden md:flex w-52 flex-shrink-0 sidebar-glass flex-col">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-base tracking-tight text-foreground">
              {t('app.name')}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                'group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150',
                isActive
                  ? 'nav-active-indicator bg-primary/[0.08] text-foreground font-medium sidebar-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors duration-150',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-2 border-t border-border space-y-1.5">
          {/* Language switcher */}
          <div className="flex gap-0.5 px-1 mb-1 bg-secondary/50 rounded-md p-0.5">
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2.5 text-muted-foreground hover:text-destructive transition-colors duration-150"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {t('auth.signOut')}
            </Button>
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
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col pb-14 md:pb-0">
        {children}
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-14 border-t border-border glass flex z-30">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight transition-colors duration-150',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span className={cn(isActive && 'font-medium')}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground"
          onClick={toggle}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </nav>
    </div>
  )
}

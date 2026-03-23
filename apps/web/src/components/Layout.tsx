import { NavLink, useNavigate } from 'react-router-dom'
import { FileText, Folder, GitBranch, Settings, LogOut, Plus } from 'lucide-react'
import { logout } from '@/store/auth'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

const nav = [
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/projects', icon: Folder, label: 'Projects' },
  { to: '/connections', icon: GitBranch, label: 'Connections' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 border-r flex flex-col">
        <div className="p-4 border-b">
          <span className="font-semibold text-sm tracking-tight">IdeaVault</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}

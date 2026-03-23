import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth as authApi } from '@/lib/api'
import { setAuth } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

export function LoginPage() {
  const nav = useNavigate()
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
      toast({ title: 'Login failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IdeaVault</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground">
          No account?{' '}
          <Link to="/register" className="text-foreground underline underline-offset-4">Register</Link>
        </p>
      </div>
    </div>
  )
}

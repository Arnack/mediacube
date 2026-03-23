import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth as authApi } from '@/lib/api'
import { setAuth } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/useToast'

export function RegisterPage() {
  const nav = useNavigate()
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
      toast({ title: 'Registration failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IdeaVault</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <Input type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground">
          Have an account?{' '}
          <Link to="/login" className="text-foreground underline underline-offset-4">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

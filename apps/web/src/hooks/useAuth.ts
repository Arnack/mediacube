import { useState, useEffect } from 'react'
import { getUser, getToken, onAuthChange } from '../store/auth'
import { auth as authApi } from '../lib/api'
import { setAuth as storeSetAuth, logout as storeLogout } from '../store/auth'

export function useAuth() {
  const [user, setUser] = useState(getUser)
  const [loading, setLoading] = useState(!getUser() && !!getToken())

  useEffect(() => {
    const off = onAuthChange(() => setUser(getUser()))
    return off
  }, [])

  useEffect(() => {
    if (!getUser() && getToken()) {
      authApi.me()
        .then((data: any) => storeSetAuth(data.user, getToken()!))
        .catch(() => storeLogout())
        .finally(() => setLoading(false))
    }
  }, [])

  return { user, loading, isAuthenticated: !!user }
}

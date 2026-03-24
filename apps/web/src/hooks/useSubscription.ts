import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { subscription as subApi } from '@/lib/api'

interface UsageEntry { used: number; limit: number }
interface UsageData {
  notes: UsageEntry
  ai_calls: UsageEntry
  url_parses: UsageEntry
}

const defaultUsage: UsageData = {
  notes: { used: 0, limit: 10 },
  ai_calls: { used: 0, limit: 10 },
  url_parses: { used: 0, limit: 5 },
}

export function useSubscription() {
  const { user } = useAuth()
  const [usage, setUsage] = useState<UsageData>(defaultUsage)
  const [loading, setLoading] = useState(true)

  const plan = user?.plan ?? 'free'
  const isPro = plan === 'pro'

  const refreshUsage = useCallback(async () => {
    try {
      const data = await subApi.usage() as any
      if (data.usage) setUsage(data.usage)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) refreshUsage()
    else setLoading(false)
  }, [user, refreshUsage])

  const checkout = useCallback(async () => {
    const data = await subApi.checkout() as any
    if (data.url) window.location.href = data.url
  }, [])

  const openPortal = useCallback(async () => {
    const data = await subApi.portal() as any
    if (data.url) window.location.href = data.url
  }, [])

  return { plan, isPro, usage, loading, checkout, openPortal, refreshUsage }
}

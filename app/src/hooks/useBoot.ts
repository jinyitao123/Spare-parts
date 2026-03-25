import { useEffect, useState } from 'react'
import { fetchDevToken, healthCheck, setToken } from '../api'
import { useUser } from '../context/UserContext'

type Status = 'checking' | 'online' | 'offline'

/**
 * Initializes the API connection on app startup.
 * Checks Weave health → fetches dev JWT → stores it.
 * Returns connection status so the UI can show mock narratives when offline.
 */
export function useBoot() {
  const [status, setStatus] = useState<Status>('checking')
  const { user } = useUser()

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const ok = await healthCheck()
      if (cancelled) return

      if (!ok) {
        setStatus('offline')
        return
      }

      try {
        const token = await fetchDevToken('default', user.role)
        if (cancelled) return
        setToken(token)
        setStatus('online')
      } catch {
        setStatus('offline')
      }
    }

    boot()
    return () => { cancelled = true }
  }, [user.role])

  return status
}

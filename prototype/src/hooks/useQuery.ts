import { useState, useEffect, useCallback } from 'react'

interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useQuery<T>(fetcher: () => Promise<T>, deps: any[] = []): QueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(() => {
    setLoading(true)
    setError(null)
    fetcher()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, deps)

  useEffect(() => { fetch_() }, [fetch_])

  return { data, loading, error, refetch: fetch_ }
}

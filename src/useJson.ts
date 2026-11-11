import { useEffect, useState } from 'react'

// 주소의 JSON을 불러온다. data가 undefined면 불러오는 중, null이면 실패다. url이 null이면 부르지 않는다
export function useJson<T>(url: string | null) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data: T | null }>()
  // 주소가 바뀌거나 다시 시도하면 key가 달라져서, 예전 결과는 "불러오는 중"으로 보인다
  const key = `${url}#${attempt}`

  useEffect(() => {
    if (url === null) return
    const controller = new AbortController()
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<T>
      })
      .then((data) => setResult({ key, data }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, data: null })
      })
    return () => controller.abort()
  }, [url, key])

  return { data: result?.key === key ? result.data : undefined, retry: () => setAttempt((count) => count + 1) }
}

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001'

export async function api(path: string, init: RequestInit = {}) {
  const isBrowser = typeof window !== 'undefined'
  const base = isBrowser ? '/api/proxy' : API_BASE
  const url = `${base}${path.startsWith('/') ? path : '/' + path}`
  const headers = new Headers(init.headers || {})
  if (isBrowser) {
    const token = localStorage.getItem('token')
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  }
  try {
    let res = await fetch(url, { ...init, headers })
    if (isBrowser && res.status === 401 && !headers.get('x-retried')) {
      // Try refresh once
      const refresh_token = localStorage.getItem('refresh_token')
      if (refresh_token) {
        try {
          const r = await fetch(`${base}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token })
          })
          if (r.ok) {
            const data = await r.json()
            if (data?.access_token) {
              localStorage.setItem('token', data.access_token)
              headers.set('Authorization', `Bearer ${data.access_token}`)
              headers.set('x-retried', '1')
              res = await fetch(url, { ...init, headers })
              return res
            }
          }
        } catch {}
      }
    }
    return res
  } catch (e) {
    if (!isBrowser) throw e
    // Browser fallback: call backend port directly if proxy failed
    const origin = window.location.origin
    const directBase = origin.includes(':3000') ? origin.replace(':3000', ':8001') : origin
    const directUrl = `${directBase}${path}`
    let res = await fetch(directUrl, { ...init, headers })
    if (res.status === 401 && isBrowser && !headers.get('x-retried')) {
      const refresh_token = localStorage.getItem('refresh_token')
      if (refresh_token) {
        try {
          const r = await fetch(`${directBase}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token })
          })
          if (r.ok) {
            const data = await r.json()
            if (data?.access_token) {
              localStorage.setItem('token', data.access_token)
              headers.set('Authorization', `Bearer ${data.access_token}`)
              headers.set('x-retried', '1')
              res = await fetch(directUrl, { ...init, headers })
            }
          }
        } catch {}
      }
    }
    return res
  }
}

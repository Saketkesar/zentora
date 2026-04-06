import type { NextApiRequest, NextApiResponse } from 'next'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path = [] } = req.query
  const targetPath = Array.isArray(path) ? path.join('/') : path
  const isStatic = targetPath.startsWith('static/')
  
  // Build query string from all query params except 'path'
  const queryParams = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'path' && value) {
      const val = Array.isArray(value) ? value[0] : value
      queryParams.append(key, val)
    }
  }
  const queryString = queryParams.toString()
  const url = `${API_BASE}${isStatic ? '' : '/api'}/${targetPath}${queryString ? '?' + queryString : ''}`

  try {
    const headers: Record<string, string> = {}
    // Forward most headers except host-related
    const drop = new Set(['host','connection','content-length','transfer-encoding','content-encoding','accept-encoding','expect'])
    for (const [k, v] of Object.entries(req.headers)) {
      const kl = k.toLowerCase()
      if (typeof v === 'string' && !drop.has(kl)) headers[kl] = v
    }
    let init: any = { method: req.method, headers }
    const method = (req.method || 'GET').toUpperCase()
    let reusableBody: Uint8Array | undefined
  if (!['GET','HEAD'].includes(method)) {
      const ct = req.headers['content-type'] || ''
      const ctStr = typeof ct === 'string' ? ct.toLowerCase() : ''
      const hasBodyHeader = (typeof req.headers['content-length'] === 'string' && Number(req.headers['content-length']) > 0) || !!req.headers['transfer-encoding']
      if (ctStr.startsWith('multipart/form-data')) {
        // Stream multipart directly
        init.body = req as any
        // @ts-ignore
        init.duplex = 'half'
      } else if (['POST','PUT','PATCH'].includes(method) || (method === 'DELETE' && hasBodyHeader)) {
        // Buffer JSON or other small payloads when there's a body
        const chunks: Uint8Array[] = []
        await new Promise<void>((resolve, reject) => {
          (req as any).on('data', (c: Uint8Array) => chunks.push(c))
          ;(req as any).on('end', () => resolve())
          ;(req as any).on('error', (e: any) => reject(e))
        })
        let total = 0
        for (const c of chunks) total += c.byteLength
        const merged = new Uint8Array(total)
        let offset = 0
        for (const c of chunks) { merged.set(c, offset); offset += c.byteLength }
        if (ctStr.includes('application/json')) {
          const bodyStr = new TextDecoder().decode(merged)
          init.body = bodyStr
          reusableBody = merged
          headers['content-type'] = 'application/json'
        } else if (merged.byteLength > 0) {
          init.body = merged
          reusableBody = merged
        }
        // Do NOT set content-length manually; let fetch compute it
      } else {
        // No body (common for DELETE): leave body undefined and drop body-related headers
        delete headers['content-type']
        delete headers['content-length']
      }
    }
  let r: Response | undefined
    try {
      r = await fetch(url, init)
    } catch (err) {
      // Fallback attempts if API_BASE host resolution fails
      const tryUrls = [
        `http://backend:8000${isStatic ? '' : '/api'}/${targetPath}${queryString ? '?' + queryString : ''}`,
        `http://localhost:8001${isStatic ? '' : '/api'}/${targetPath}${queryString ? '?' + queryString : ''}`,
      ]
      let lastErr = err
      for (const u of tryUrls) {
        try {
          const altInit = { ...init }
          if (reusableBody) altInit.body = reusableBody
          const resp = await fetch(u, altInit as any)
          if (resp) { r = resp; break }
        } catch (e2) {
          lastErr = e2
        }
      }
      if (!r) throw lastErr
    }
    const contentType = r.headers.get('content-type') || undefined
    res.status(r.status)
    if (contentType && contentType.includes('application/json')) {
      const data = await r.json().catch(async () => {
        // Fallback: some DELETE endpoints may return empty body but JSON content-type
        return null
      })
      if (data === null) {
        res.end()
      } else {
        res.json(data)
      }
    } else {
      const ab = await r.arrayBuffer().catch(() => new ArrayBuffer(0))
      const buf = Buffer.from(ab)
      if (contentType) {
        try { res.setHeader('content-type', contentType) } catch {}
      }
      if (buf.length > 0) {
        res.send(buf)
      } else {
        res.end()
      }
    }
  } catch (e: any) {
    res.status(502).json({ error: 'proxy_failed', message: e?.message || 'unknown' })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}

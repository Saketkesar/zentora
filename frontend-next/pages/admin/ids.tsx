import Head from 'next/head'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { api, API_BASE } from '../../src/lib/api'
import Link from 'next/link'
import { ArrowLeft, Printer, Map as MapIcon, Camera, CheckCircle2 } from 'lucide-react'
import { Avatar } from '../../src/components/Avatar'

type VerifiedUser = { id: number; name: string; email: string; profile_photo_url?: string | null }
type TouristIdItem = { id: number; user_id: number; uuid: string; qr_url: string | null; valid_from?: string | null; valid_to?: string | null }

export default function AdminIdsPage() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<VerifiedUser[]>([])
  const [selected, setSelected] = useState<VerifiedUser | null>(null)
  const [ids, setIds] = useState<TouristIdItem[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const loadUsers = async () => {
    const res = await api(`/api/admin/users/verified${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    if (res.ok) {
      const data = await res.json()
      setUsers(data.items || [])
    }
  }

  const loadIds = async (userId?: number) => {
    const res = await api(`/api/admin/tourist-ids${userId ? `?user_id=${userId}` : ''}`)
    if (res.ok) {
      const data = await res.json()
      setIds(data.items || [])
    }
  }

  useEffect(() => { loadUsers() }, [])
  // Preselect user if provided via query
  useEffect(() => {
    const uid = router.query.user_id ? Number(router.query.user_id) : NaN
    if (!isNaN(uid) && users.length > 0) {
      const found = users.find(u => u.id === uid)
      if (found) {
        setSelected(found)
        setUseCam(true)
        // Prefill validity: now to +30 days
        const now = new Date()
        const to = new Date(now.getTime() + 30*24*3600*1000)
        setValidFrom(now.toISOString().slice(0,16))
        setValidTo(to.toISOString().slice(0,16))
      }
    }
  }, [router.query.user_id, users])
  useEffect(() => { loadIds(selected?.id || undefined) }, [selected?.id])

  const [useCam, setUseCam] = useState(false)
  const [photoData, setPhotoData] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [validFrom, setValidFrom] = useState<string>('')
  const [validTo, setValidTo] = useState<string>('')

  useEffect(() => {
    let stream: MediaStream | null = null
    const start = async () => {
      if (!useCam) return
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {}
    }
    start()
    return () => { if (stream) stream.getTracks().forEach(t=>t.stop()) }
  }, [useCam])

  const snap = () => {
    if (!videoRef.current || !canvasRef.current) return
    const v = videoRef.current
    const c = canvasRef.current
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const data = c.toDataURL('image/jpeg', 0.9)
    setPhotoData(data)
  }

  const uploadPhotoIfAny = async (userId: number) => {
    if (!photoData) return
    const blob = await (await fetch(photoData)).blob()
    const form = new FormData()
    form.append('photo', blob, 'profile.jpg')
    await api(`/api/admin/users/${userId}/profile-photo`, { method: 'POST', body: form })
  }

  const generateId = async () => {
    if (!selected) return
    if (!validFrom || !validTo) {
      alert('Please select validity start and end date-time')
      return
    }
    setLoading(true)
    try {
      await uploadPhotoIfAny(selected.id)
      const now = new Date(validFrom)
      const to = new Date(validTo)
      const res = await api(`/api/admin/users/${selected.id}/tourist-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid_from: now.toISOString(), valid_to: to.toISOString() })
      })
      if (res.ok) {
        await loadIds(selected.id)
        setPhotoData(null)
        setUseCam(false)
        setValidFrom('')
        setValidTo('')
        setToast('Tourist ID created'); setTimeout(()=>setToast(null), 2000)
      } else {
        alert('Failed to create ID')
      }
    } finally { setLoading(false) }
  }

  const deleteId = async (id: number) => {
    if (!confirm('Delete this Tourist ID?')) return
    setLoading(true)
    try {
      const res = await api(`/api/admin/tourist-ids/${id}`, { method: 'DELETE' })
      if (res.ok) { await loadIds(selected?.id || undefined); setToast('Tourist ID deleted'); setTimeout(()=>setToast(null), 2000) }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-white text-black px-3 sm:px-4 py-6">
      <Head><title>Tourist IDs - Admin</title></Head>
      <div className="max-w-5xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm border rounded px-2 py-1"><ArrowLeft className="text-neutral-700" size={14} /> Back</Link> Tourist IDs</h1>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Search verified users... (name/email)"
              className="border rounded px-3 py-2 bg-transparent"
            />
            <button onClick={loadUsers} className="px-3 py-2 rounded bg-black text-white">Search</button>
          </div>
        </header>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="p-4 border rounded-2xl border-neutral-200">
            <h2 className="font-semibold mb-3">Verified Users</h2>
            <div className="grid gap-2 max-h-[420px] overflow-auto pr-1">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={`flex items-center gap-3 p-2 rounded border ${selected?.id === u.id ? 'border-blue-500 bg-blue-50' : 'border-neutral-200'}`}
                >
                  <Avatar src={u.profile_photo_url || undefined} alt={u.name} size={40} className="w-10 h-10" />
                  <div className="text-left">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-neutral-500">{u.email}</div>
                  </div>
                </button>
              ))}
              {users.length === 0 && <div className="text-sm text-neutral-500">No verified users.</div>}
            </div>
          </div>
          <div className="p-4 border rounded-2xl border-neutral-200 relative">
            {toast && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded bg-black text-white text-xs shadow">{toast}</div>
            )}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2"><Camera className="text-neutral-700" size={16} /> Generate ID</h2>
              <button disabled={!selected || loading} onClick={generateId} className="px-3 py-2 rounded bg-black text-white disabled:opacity-50 inline-flex items-center gap-1"><CheckCircle2 className="text-neutral-700" size={16} /> Generate for Selected</button>
            </div>
            <p className="text-sm text-neutral-500 mb-3">Only Aadhaar-verified users appear here. Select one to generate a new Tourist ID. The latest ID is what the tourist sees.</p>
            {selected && (
              <div className="flex items-center gap-3 mb-3 p-2 rounded border border-neutral-200">
                <Avatar src={selected.profile_photo_url || undefined} alt={selected.name} size={40} className="w-10 h-10" />
                <div>
                  <div className="font-medium">{selected.name}</div>
                  <div className="text-xs text-neutral-500">{selected.email}</div>
                </div>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <label className="grid gap-1 text-sm">
                <span>Valid from</span>
                <input type="datetime-local" value={validFrom} onChange={e=>setValidFrom(e.target.value)} className="border rounded px-2 py-1 bg-transparent" />
              </label>
              <label className="grid gap-1 text-sm">
                <span>Valid to</span>
                <input type="datetime-local" value={validTo} onChange={e=>setValidTo(e.target.value)} className="border rounded px-2 py-1 bg-transparent" />
              </label>
            </div>
            <div className="flex items-center gap-2 mb-3 text-xs">
              <button type="button" onClick={()=>{ const now=new Date(); setValidFrom(now.toISOString().slice(0,16)) }} className="px-2 py-1 rounded border">Now</button>
              <button type="button" onClick={()=>{ if(!validFrom){const now=new Date(); setValidFrom(now.toISOString().slice(0,16))}; const from = new Date(validFrom || new Date()); const to = new Date(from.getTime()+1*3600*1000); setValidTo(to.toISOString().slice(0,16)) }} className="px-2 py-1 rounded border">+1 hour</button>
              <button type="button" onClick={()=>{ if(!validFrom){const now=new Date(); setValidFrom(now.toISOString().slice(0,16))}; const from = new Date(validFrom || new Date()); const to = new Date(from.getTime()+24*3600*1000); setValidTo(to.toISOString().slice(0,16)) }} className="px-2 py-1 rounded border">+24 hours</button>
              <button type="button" onClick={()=>{ if(!validFrom){const now=new Date(); setValidFrom(now.toISOString().slice(0,16))}; const from = new Date(validFrom || new Date()); const to = new Date(from.getTime()+30*24*3600*1000); setValidTo(to.toISOString().slice(0,16)) }} className="px-2 py-1 rounded border">+30 days</button>
              <button type="button" onClick={()=>{ setValidFrom(''); setValidTo('') }} className="px-2 py-1 rounded border">Clear</button>
            </div>
            <div className="mb-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useCam} onChange={e=>setUseCam(e.target.checked)} /> Capture live photo at counter
              </label>
              {useCam && (
                <div className="mt-2 grid grid-cols-2 gap-3 items-start">
                  <div>
                    <video ref={videoRef} className="w-full rounded border" />
                    <button type="button" onClick={snap} className="mt-2 px-3 py-1.5 rounded border">Take snapshot</button>
                  </div>
                  <div>
                    <canvas ref={canvasRef} className="w-full rounded border" />
                    {photoData && <div className="text-xs text-neutral-500 mt-1">Snapshot ready — will upload with ID</div>}
                  </div>
                </div>
              )}
            </div>
            <h3 className="font-medium mb-2">Generated IDs {selected ? `(for ${selected.name})` : ''}</h3>
            <div className="grid gap-2 max-h-[420px] overflow-auto pr-1">
              {ids.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-2 rounded border border-neutral-200">
                  <div>
                    <div className="font-mono text-sm">{item.uuid.slice(0,8)}…</div>
                    <div className="text-xs text-neutral-500">{item.valid_from?.replace('T',' ').replace('Z','')} → {item.valid_to?.replace('T',' ').replace('Z','')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.qr_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/proxy${item.qr_url}`} alt="qr" className="w-10 h-10 bg-neutral-200 rounded" loading="lazy" onError={(e)=>{ const t=e.target as HTMLImageElement; t.onerror=null; t.src='/placeholder-qr.png' }} />
                    )}
                    <button onClick={() => deleteId(item.id)} className="px-2 py-1 rounded border border-red-300 text-red-600">Delete</button>
                  </div>
                </div>
              ))}
              {ids.length === 0 && <div className="text-sm text-neutral-500">No IDs yet.</div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

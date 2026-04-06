import Head from 'next/head'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { api, API_BASE } from '../../src/lib/api'
import Link from 'next/link'
import { ArrowLeft, Printer, Map as MapIcon, Camera, CheckCircle2, Loader2 } from 'lucide-react'
import { Avatar } from '../../src/components/Avatar'
import { playSuccessBeep } from '../../src/lib/audioUtils'

type VerifiedUser = { id: number; name: string; email: string; profile_photo_url?: string | null }
type TouristIdItem = { id: number; user_id: number; uuid: string; qr_url: string | null; valid_from?: string | null; valid_to?: string | null }

export default function AdminIdsPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<VerifiedUser[]>([])
  const [selected, setSelected] = useState<VerifiedUser | null>(null)
  const [ids, setIds] = useState<TouristIdItem[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [validFrom, setValidFrom] = useState<string>('')
  const [validTo, setValidTo] = useState<string>('')
  const [cameraActive, setCameraActive] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

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
  useEffect(() => {
    const uid = router.query.user_id ? Number(router.query.user_id) : NaN
    if (!isNaN(uid) && users.length > 0) {
      const found = users.find(u => u.id === uid)
      if (found) {
        setSelected(found)
        const now = new Date()
        const to = new Date(now.getTime() + 30*24*3600*1000)
        setValidFrom(now.toISOString().slice(0,16))
        setValidTo(to.toISOString().slice(0,16))
      }
    }
  }, [router.query.user_id, users])
  useEffect(() => { loadIds(selected?.id || undefined) }, [selected?.id])

  useEffect(() => {
    if (selected) {
      setCameraActive(false)
      setCapturedPhoto(null)
      setCameraError(null)
    }
  }, [selected?.id])

  useEffect(() => {
    if (!cameraActive) return
    const startCamera = async () => {
      try {
        setCameraError(null)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      } catch (err: any) {
        setCameraError(err.message || 'Failed to access camera')
        setCameraActive(false)
      }
    }
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [cameraActive])

  const playBeep = () => {
    try {
      const audioContext = new (window as any).AudioContext()
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain)
      gain.connect(audioContext.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.04, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12)
      osc.start()
      osc.stop(audioContext.currentTime + 0.12)
    } catch {}
  }

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return
    try {
      const ctx = canvasRef.current.getContext('2d')
      if (!ctx) return
      canvasRef.current.width = videoRef.current.videoWidth
      canvasRef.current.height = videoRef.current.videoHeight
      if (videoRef.current.readyState < 2) {
        setCameraError('Camera still loading')
        return
      }
      ctx.drawImage(videoRef.current, 0, 0)
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          setCapturedPhoto(blob)
          playBeep()
        }
      }, 'image/jpeg', 0.95)
    } catch (err: any) {
      setCameraError(err.message || 'Capture failed')
    }
  }

  const generateId = async () => {
    if (!selected) return
    if (!validFrom || !validTo) {
      alert('Please select validity start and end date-time')
      return
    }
    setLoading(true)
    try {
      const now = new Date(validFrom)
      const to = new Date(validTo)
      
      // Convert captured photo blob to base64 if available
      let profilePhotoBase64 = null
      if (capturedPhoto) {
        const reader = new FileReader()
        profilePhotoBase64 = await new Promise((resolve, reject) => {
          reader.onload = () => {
            const base64String = reader.result as string
            resolve(base64String.split(',')[1] || base64String)
          }
          reader.onerror = reject
          reader.readAsDataURL(capturedPhoto)
        })
      }
      
      const res = await api(`/api/admin/users/${selected.id}/tourist-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          valid_from: now.toISOString(), 
          valid_to: to.toISOString(),
          profile_photo: profilePhotoBase64
        })
      })
      if (res.ok) {
        playSuccessBeep()
        await loadIds(selected.id)
        setValidFrom('')
        setValidTo('')
        setCapturedPhoto(null)
        setToast('Tourist ID created successfully'); 
        setTimeout(()=>setToast(null), 3000)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-black px-3 sm:px-4 py-6">
      <Head><title>Tourist IDs - Admin</title></Head>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50 transition-colors">
              <ArrowLeft size={18} /> Back
            </Link>
            <h1 className="text-3xl font-bold">Tourist IDs</h1>
          </div>
          <button onClick={loadUsers} className="px-4 py-2 rounded-lg bg-black text-white font-medium hover:bg-neutral-900 transition-colors">
            Refresh
          </button>
        </header>

        {/* Search bar */}
        <div className="mb-6 flex gap-3">
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Search verified users by name or email..."
            className="flex-1 border-2 border-neutral-300 rounded-lg px-4 py-3 bg-white focus:border-blue-500 focus:outline-none transition-colors"
          />
          <button onClick={loadUsers} className="px-6 py-3 rounded-lg bg-black text-white font-medium hover:bg-neutral-900 transition-colors">
            Search
          </button>
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Users list */}
          <div className="lg:col-span-1 p-6 border-2 border-neutral-200 rounded-2xl bg-white shadow-lg">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 size={22} className="text-blue-600" />
              Verified Users
            </h2>
            <div className="grid gap-2 max-h-96 overflow-auto pr-2">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                    selected?.id === u.id 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <Avatar src={u.profile_photo_url || undefined} alt={u.name} size={40} className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{u.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{u.email}</div>
                  </div>
                </button>
              ))}
              {users.length === 0 && (
                <div className="text-sm text-neutral-500 text-center py-8">No verified users found</div>
              )}
            </div>
          </div>

          {/* Right: ID Generation & Photo Capture */}
          <div className="lg:col-span-2 p-6 border-2 border-neutral-200 rounded-2xl bg-white shadow-lg">
            {toast && (
              <div className="mb-4 p-4 rounded-lg bg-emerald-50 border-2 border-emerald-300 text-emerald-700 font-medium flex items-center gap-2">
                <CheckCircle2 size={20} /> {toast}
              </div>
            )}

            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera size={22} className="text-blue-600" />
              Generate Tourist ID
            </h2>

            {!selected ? (
              <div className="text-center py-12 text-neutral-500">
                <Camera size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-base">Select a verified user from the left to generate a Tourist ID</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Selected user info */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-blue-50 border-2 border-blue-200">
                  <Avatar src={selected.profile_photo_url || undefined} alt={selected.name} size={50} className="w-12 h-12 rounded-lg" />
                  <div>
                    <div className="font-semibold text-lg">{selected.name}</div>
                    <div className="text-sm text-neutral-600">{selected.email}</div>
                  </div>
                </div>

                {/* Validity settings */}
                <div>
                  <label className="block text-sm font-semibold mb-3">ID Validity Period</label>
                  <div className="grid md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="text-sm text-neutral-600 mb-1 block">Valid from</label>
                      <input 
                        type="datetime-local" 
                        value={validFrom} 
                        onChange={e=>setValidFrom(e.target.value)} 
                        className="w-full border-2 border-neutral-300 rounded-lg px-3 py-2 bg-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-600 mb-1 block">Valid to</label>
                      <input 
                        type="datetime-local" 
                        value={validTo} 
                        onChange={e=>setValidTo(e.target.value)} 
                        className="w-full border-2 border-neutral-300 rounded-lg px-3 py-2 bg-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button 
                      type="button" 
                      onClick={()=>{ const now=new Date(); setValidFrom(now.toISOString().slice(0,16)) }} 
                      className="px-3 py-1 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50"
                    >
                      Now
                    </button>
                    <button 
                      type="button" 
                      onClick={()=>{ if(!validFrom){const now=new Date(); setValidFrom(now.toISOString().slice(0,16))}; const from = new Date(validFrom || new Date()); const to = new Date(from.getTime()+1*3600*1000); setValidTo(to.toISOString().slice(0,16)) }} 
                      className="px-3 py-1 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50"
                    >
                      +1h
                    </button>
                    <button 
                      type="button" 
                      onClick={()=>{ if(!validFrom){const now=new Date(); setValidFrom(now.toISOString().slice(0,16))}; const from = new Date(validFrom || new Date()); const to = new Date(from.getTime()+24*3600*1000); setValidTo(to.toISOString().slice(0,16)) }} 
                      className="px-3 py-1 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50"
                    >
                      +24h
                    </button>
                    <button 
                      type="button" 
                      onClick={()=>{ if(!validFrom){const now=new Date(); setValidFrom(now.toISOString().slice(0,16))}; const from = new Date(validFrom || new Date()); const to = new Date(from.getTime()+30*24*3600*1000); setValidTo(to.toISOString().slice(0,16)) }} 
                      className="px-3 py-1 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50"
                    >
                      +30d
                    </button>
                    <button 
                      type="button" 
                      onClick={()=>{ setValidFrom(''); setValidTo('') }} 
                      className="px-3 py-1 rounded-lg border-2 border-red-300 text-red-600 bg-white hover:bg-red-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Camera capture for profile photo */}
                <div className="border-2 border-neutral-300 rounded-lg p-4 bg-neutral-50">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold">Profile Photo for ID</label>
                    <button 
                      type="button"
                      onClick={() => setCameraActive(!cameraActive)}
                      className={`px-3 py-1 rounded-lg border-2 font-medium text-sm transition-colors ${
                        cameraActive
                          ? 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100'
                          : 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {cameraActive ? 'Close Camera' : 'Open Camera'}
                    </button>
                  </div>

                  {cameraError && (
                    <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                      {cameraError}
                    </div>
                  )}

                  {cameraActive && (
                    <div className="space-y-3">
                      <video
                        ref={videoRef}
                        className="w-full rounded-lg border-2 border-neutral-300 bg-black object-cover"
                        style={{ maxHeight: '300px' }}
                        onLoadedMetadata={() => setCameraError(null)}
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={capture}
                          className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <Camera size={18} />
                          Capture Photo
                        </button>
                      </div>
                    </div>
                  )}

                  {capturedPhoto && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-semibold text-green-700">Photo captured successfully</div>
                      <button 
                        type="button"
                        onClick={() => setCapturedPhoto(null)}
                        className="text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
                      >
                        Retake photo
                      </button>
                    </div>
                  )}
                </div>

                {/* Generate button */}
                <button 
                  disabled={loading || !validFrom || !validTo} 
                  onClick={generateId}
                  className="w-full px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Generating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      Generate Tourist ID
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Generated IDs list */}
        {selected && (
          <div className="mt-6 p-6 border-2 border-neutral-200 rounded-2xl bg-white shadow-lg">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Printer size={22} className="text-blue-600" />
              Generated IDs for {selected.name}
            </h2>
            <div className="grid gap-3 max-h-96 overflow-auto">
              {ids.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-4 p-4 rounded-lg border-2 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                  <div className="flex-1">
                    <div className="font-mono text-sm font-semibold">{item.uuid.slice(0,12)}…</div>
                    <div className="text-xs text-neutral-600 mt-1">
                      {new Date(item.valid_from || '').toLocaleString()} → {new Date(item.valid_to || '').toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.qr_url && (
                      <img 
                        src={`/api/proxy${item.qr_url}`} 
                        alt="qr" 
                        className="w-12 h-12 bg-white rounded-lg border-2 border-neutral-200" 
                        loading="lazy" 
                        onError={(e)=>{ const t=e.target as HTMLImageElement; t.onerror=null; t.src='/placeholder-qr.png' }} 
                      />
                    )}
                    <button 
                      onClick={() => deleteId(item.id)}
                      className="px-3 py-2 rounded-lg border-2 border-red-300 text-red-600 font-medium hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {ids.length === 0 && (
                <div className="text-center py-8 text-neutral-500">No IDs generated yet for this user</div>
              )}
            </div>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

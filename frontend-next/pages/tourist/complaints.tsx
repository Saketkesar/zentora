import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../src/lib/api'
import { useRouter } from 'next/router'
import { MapPin, UploadCloud, Loader2, Image as ImageIcon, ArrowLeft } from 'lucide-react'

export default function Complaints() {
  const [desc, setDesc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const getLocation = async () => {
    if (!('geolocation' in navigator)) return alert('Location not available')
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
      () => alert('Unable to get location'),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 5000 }
    )
  }

  const onFile = (f: File | null) => {
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    if (f) setPreview(URL.createObjectURL(f))
    else setPreview(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('description', desc)
      if (file) fd.append('image', file)
      if (lat != null) fd.append('lat', String(lat))
      if (lng != null) fd.append('lng', String(lng))
      // Try proxy first
      let ok = false
      try {
        const res = await fetch(`${window.location.origin}/api/proxy/incidents`, { method: 'POST', body: fd })
        ok = res.ok
      } catch {}
      if (!ok) {
        const r2 = await api('/api/incidents', { method: 'POST', body: fd })
        ok = r2.ok
      }
      if (ok) {
        alert('Complaint submitted')
        router.replace('/tourist/dashboard')
      } else {
        alert('Submission failed')
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="min-h-screen bg-white text-black px-3 sm:px-4 py-4">
      <Head><title>Complaint - Zentora</title></Head>
      <div className="max-w-md mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">File Complaint</h1>
          <Link className="text-sm inline-flex items-center gap-1 underline" href="/tourist/dashboard"><ArrowLeft size={14} /> Back</Link>
        </header>
        <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-700">Describe incident</span>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Describe incident" className="border rounded-xl px-3 py-2 bg-transparent min-h-28" />
          </label>
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={getLocation} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white text-sm"><MapPin size={16} /> Use my location</button>
              {(lat!=null && lng!=null) && <span className="text-xs text-neutral-600">{lat.toFixed(4)}, {lng.toFixed(4)}</span>}
            </div>
            <div className="text-xs text-neutral-500">Tip: Attach a photo and location so police can respond faster.</div>
            <div className="border-2 border-dashed rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e=>onFile(e.target.files?.[0]||null)} />
              <button type="button" onClick={()=>fileInputRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-1.5 rounded border text-sm">
                <UploadCloud size={16} /> Browse & Upload
              </button>
              {preview && (
                <div className="mt-3 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="preview" className="w-48 h-48 object-cover rounded-lg ring-1 ring-white/10 shadow" />
                </div>
              )}
            </div>
          </div>
          <button disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white inline-flex items-center gap-2 justify-center">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} Submit
          </button>
        </form>
      </div>
    </div>
  )
}

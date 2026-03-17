import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { api } from '../../src/lib/api'
import { Shield, Map, Home as HomeIcon, LogOut, PlusCircle } from 'lucide-react'

const LeafletMap = dynamic(async () => {
  return function LeafletPicker({ onCreate }: { onCreate: (center: [number, number], radius: number, name: string, kind: 'safe'|'unsafe') => void }) {
    const ref = useRef<HTMLDivElement>(null)
    const [radius, setRadius] = useState(200)
    const [name, setName] = useState('New Zone')
    const [kind, setKind] = useState<'safe'|'unsafe'>('safe')
  const centerRef = useRef<[number, number]>([29.908044, 77.925801])
    useEffect(() => {
      let map: any
      let circle: any
      ;(async () => {
        // @ts-ignore - dynamic import without types
        const L: any = await import('leaflet')
        // @ts-ignore
        map = L.map(ref.current as HTMLDivElement).setView(centerRef.current, 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map)
        circle = L.circle(map.getCenter(), { radius, color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.2 }).addTo(map)
        map.on('move', () => { const c = map.getCenter(); centerRef.current = [c.lat, c.lng]; circle.setLatLng(c) })
      })()
      return () => { if (map) map.remove() }
    }, [])
    return (
      <div className="grid gap-2">
        <div ref={ref} className="w-full h-64 rounded overflow-hidden border border-neutral-200 dark:border-neutral-800" />
        <label className="flex items-center gap-2 text-sm">
          Name
          <input value={name} onChange={e=>setName(e.target.value)} className="border rounded px-2 py-1 bg-transparent" />
          Radius (m)
          <input type="number" value={radius} onChange={e=>setRadius(Number(e.target.value))} className="border rounded px-2 py-1 w-28 bg-transparent" />
          Kind
          <select value={kind} onChange={e=>setKind(e.target.value as any)} className="border rounded px-2 py-1 bg-transparent">
            <option value="safe">safe</option>
            <option value="unsafe">unsafe</option>
          </select>
        </label>
        <button onClick={()=> onCreate(centerRef.current, radius, name, kind)} className="self-start px-3 py-1.5 rounded bg-black text-white dark:bg-white dark:text-black flex items-center gap-2"><PlusCircle size={16} /> Create Zone at Center</button>
      </div>
    )
  }
}, { ssr: false })

export default function AdminGeofences() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    refresh()
  }, [])

  const refresh = async () => {
    const r = await api('/api/admin/geofences')
    if (r.ok) setItems((await r.json()).items || [])
    setLoading(false)
  }

  const create = async (center: [number, number], radius: number, name: string, kind: 'safe'|'unsafe') => {
    const [lat, lng] = center
    const r = await api('/api/admin/geofences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, lat, lng, radius_m: radius, kind }) })
    if (r.ok) {
      await refresh()
      alert('Geofence created')
    } else alert('Failed to create geofence')
  }

  return (
    <div className="min-h-screen bg-white text-black px-4 py-4">
      <Head><title>Admin Geofences - Zentora</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Shield size={20} /> Geofences</h1>
        <div className="flex items-center gap-2">
          <Link className="px-3 py-1.5 rounded border border-neutral-300 flex items-center gap-1" href="/"><HomeIcon size={16} /> Home</Link>
          <Link className="px-3 py-1.5 rounded border border-neutral-300" href="/admin/dashboard">Back</Link>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 border rounded-xl border-neutral-200">
          <div className="font-semibold mb-2 flex items-center gap-2"><Map size={18} /> New Geofence</div>
          <LeafletMap onCreate={create} />
        </div>
        <div className="p-4 border rounded-xl border-neutral-200">
          <div className="font-semibold mb-2">Existing</div>
          {loading ? <div>Loading…</div> : (
            <ul className="text-sm space-y-2">
              {items.map(it => (
                <li key={it.id} className="flex items-center justify-between">
                  <span>{it.name} — {Number(it.lat).toFixed(3)},{Number(it.lng).toFixed(3)} · r={it.radius_m}m · {it.kind}</span>
                </li>
              ))}
              {items.length === 0 && <li className="text-neutral-500">No geofences</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

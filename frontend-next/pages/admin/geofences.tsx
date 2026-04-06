import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { api } from '../../src/lib/api'
import { Shield, Map, Home as HomeIcon, PlusCircle, LocateFixed, RotateCcw, Target } from 'lucide-react'

type GeofenceItem = { id: number, name: string, lat: number, lng: number, radius_m: number, kind: 'safe'|'unsafe' }

const LeafletMap = dynamic(async () => {
  return function LeafletPicker({
    onCreate,
    existing,
    onMapReady,
  }: {
    onCreate: (center: [number, number], radius: number, name: string, kind: 'safe'|'unsafe') => void
    existing: GeofenceItem[]
    onMapReady?: (map: any) => void
  }) {
    const ref = useRef<HTMLDivElement>(null)
    const [radius, setRadius] = useState(200)
    const [name, setName] = useState('New Zone')
    const [kind, setKind] = useState<'safe'|'unsafe'>('safe')
    const [center, setCenter] = useState<[number, number]>([29.908044, 77.925801])
    const centerRef = useRef<[number, number]>([29.908044, 77.925801])
    const mapInst = useRef<any>(null)
    const circleRef = useRef<any>(null)
    const existingLayerRef = useRef<any>(null)
    const LRef = useRef<any>(null)

    useEffect(() => {
      let map: any
      ;(async () => {
        // @ts-ignore - dynamic import without types
        const L: any = await import('leaflet')
        LRef.current = L
        // @ts-ignore
        map = L.map(ref.current as HTMLDivElement).setView(centerRef.current, 13)
        mapInst.current = map
        onMapReady?.(map)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map)
        existingLayerRef.current = L.layerGroup().addTo(map)
        const color = kind === 'unsafe' ? '#ef4444' : '#10b981'
        circleRef.current = L.circle(map.getCenter(), { radius, color, fillColor: color, fillOpacity: 0.18 }).addTo(map)
        map.on('move', () => {
          const c = map.getCenter()
          centerRef.current = [c.lat, c.lng]
          setCenter([c.lat, c.lng])
          if (circleRef.current) circleRef.current.setLatLng(c)
        })
      })()
      return () => { if (map) map.remove() }
    }, [])

    useEffect(() => {
      const circle = circleRef.current
      if (!circle) return
      const color = kind === 'unsafe' ? '#ef4444' : '#10b981'
      circle.setRadius(radius)
      circle.setStyle({ color, fillColor: color })
    }, [radius, kind])

    useEffect(() => {
      const L = LRef.current
      const map = mapInst.current
      if (!L || !map) return
      if (!existingLayerRef.current) existingLayerRef.current = L.layerGroup().addTo(map)
      existingLayerRef.current.clearLayers()
      for (const g of existing || []) {
        const color = g.kind === 'unsafe' ? '#ef4444' : '#10b981'
        L.circle([g.lat, g.lng], { radius: g.radius_m, color, weight: 1, fillColor: color, fillOpacity: 0.12 })
          .addTo(existingLayerRef.current)
          .bindTooltip(`${g.name} (${g.kind})`)
      }
    }, [existing])

    const centerOnUser = () => {
      if (!navigator.geolocation || !mapInst.current) return
      navigator.geolocation.getCurrentPosition(pos => {
        mapInst.current.setView([pos.coords.latitude, pos.coords.longitude], 15)
      })
    }

    const resetView = () => {
      if (!mapInst.current) return
      mapInst.current.setView([29.908044, 77.925801], 13)
    }

    const canCreate = name.trim().length > 0 && radius > 0

    return (
      <div className="grid gap-3">
        <div className="relative">
          <div ref={ref} className="w-full h-72 rounded-xl overflow-hidden border border-neutral-200 bg-white/70" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-3 h-3 rounded-full border-2 ${kind === 'unsafe' ? 'border-rose-500' : 'border-emerald-500'} bg-white shadow`} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1"><Target size={14} /> Center: {center[0].toFixed(5)}, {center[1].toFixed(5)}</span>
          <button onClick={centerOnUser} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-neutral-200 bg-white/80">
            <LocateFixed size={14} /> Use my location
          </button>
          <button onClick={resetView} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-neutral-200 bg-white/80">
            <RotateCcw size={14} /> Reset view
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-2 text-sm">
          <label className="grid gap-1">Name
            <input value={name} onChange={e=>setName(e.target.value)} className="border rounded-lg px-3 py-2 bg-white/80" />
          </label>
          <label className="grid gap-1">Radius (m)
            <input type="number" value={radius} onChange={e=>setRadius(Number(e.target.value))} className="border rounded-lg px-3 py-2 bg-white/80" />
          </label>
          <label className="grid gap-1">Kind
            <select value={kind} onChange={e=>setKind(e.target.value as any)} className="border rounded-lg px-3 py-2 bg-white/80">
              <option value="safe">safe</option>
              <option value="unsafe">unsafe</option>
            </select>
          </label>
        </div>
        <button disabled={!canCreate} onClick={()=> onCreate(centerRef.current, radius, name, kind)} className={`self-start px-4 py-2 rounded-full text-white ${canCreate ? 'bg-black' : 'bg-neutral-300 cursor-not-allowed'} flex items-center gap-2`}><PlusCircle size={16} /> Create Zone at Center</button>
      </div>
    )
  }
}, { ssr: false })

export default function AdminGeofences() {
  const [items, setItems] = useState<GeofenceItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    refresh()
  }, [])

  const refresh = async () => {
    const r = await api('/admin/geofences')
    if (r.ok) setItems((await r.json()).items || [])
    setLoading(false)
  }

  const create = async (center: [number, number], radius: number, name: string, kind: 'safe'|'unsafe') => {
    const [lat, lng] = center
    const r = await api('/admin/geofences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, lat, lng, radius_m: radius, kind }) })
    if (r.ok) {
      await refresh()
      alert('Geofence created')
    } else alert('Failed to create geofence')
  }

  const focus = (g: GeofenceItem) => {
    if (mapRef.current) mapRef.current.setView([g.lat, g.lng], 14)
    setFocusedId(g.id)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-black px-4 py-6">
      <Head><title>Admin Geofences - Zentora</title></Head>
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Map className="text-cyan-600" size={28} /> Geofences</h1>
          <p className="text-sm text-neutral-600 mt-1">Drag the map to position a zone, then set radius and type.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="px-4 py-2 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50 transition-colors text-sm font-medium inline-flex items-center gap-2" href="/admin/dashboard">← Back</Link>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 p-6 rounded-2xl bg-white border-2 border-neutral-200 shadow-sm">
          <div className="font-bold mb-4 flex items-center gap-2 text-lg"><Map className="text-cyan-600" size={20} /> New Geofence</div>
          <LeafletMap onCreate={create} existing={items} onMapReady={(map) => { mapRef.current = map }} />
        </section>
        <section className="p-6 rounded-2xl bg-white border-2 border-neutral-200 shadow-sm">
          <div className="font-bold mb-4 text-lg">Existing Zones</div>
          {loading ? (
            <div className="text-center py-8 text-neutral-500">Loading…</div>
          ) : (
            <ul className="text-sm space-y-2">
              {items.map(it => (
                <li key={it.id} className={`p-4 rounded-lg border-2 transition-all ${focusedId === it.id ? 'border-cyan-400 bg-cyan-50' : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-semibold">{it.name}</div>
                      <div className="text-xs text-neutral-600 mt-1">{Number(it.lat).toFixed(4)}, {Number(it.lng).toFixed(4)}</div>
                      <div className="text-xs text-neutral-600">⭕ {it.radius_m}m radius</div>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-lg font-semibold ${it.kind === 'unsafe' ? 'border border-rose-300 bg-rose-50 text-rose-700' : 'border border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
                      {it.kind === 'unsafe' ? 'Unsafe' : 'Safe'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
                    <button onClick={()=>focus(it)} className="flex-1 px-3 py-2 rounded-lg border-2 border-cyan-300 text-cyan-600 text-xs font-semibold hover:bg-cyan-50 transition-colors">Focus</button>
                  </div>
                </li>
              ))}
              {items.length === 0 && <li className="text-neutral-500">No geofences</li>}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

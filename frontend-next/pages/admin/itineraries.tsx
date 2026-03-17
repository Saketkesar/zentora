import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../src/lib/api'
import { Shield, CalendarPlus, Home as HomeIcon, MapPin, Route as RouteIcon, Eraser } from 'lucide-react'

export default function AdminItineraries() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('City Tour')
  const [when, setWhen] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [userId, setUserId] = useState('')
  // Map for single-point itinerary
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)
  const markerRef = useRef<any>(null)
  // Route Plan state
  const [planTitle, setPlanTitle] = useState('Route Plan')
  const planMapRef = useRef<HTMLDivElement>(null)
  const planMapInst = useRef<any>(null)
  const planPath = useRef<any>(null) // polyline
  const [pathPts, setPathPts] = useState<Array<{lat:number,lng:number}>>([])
  const [checkpoints, setCheckpoints] = useState<Array<{name:string,lat:number,lng:number}>>([])
  const cpLayerRef = useRef<any>(null)
  const [cpMode, setCpMode] = useState(false)

  const refresh = async () => {
    const r = await api('/api/admin/itineraries')
    if (r.ok) setItems((await r.json()).items || [])
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  // Initialize single-location map
  useEffect(() => {
    let map: any
    (async () => {
      const L: any = await import('leaflet')
      // Fix default marker icons
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
      })
      // @ts-ignore
      L.Marker.prototype.options.icon = DefaultIcon
      map = L.map(mapRef.current as HTMLDivElement).setView([27.2046, 77.4977], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
      mapInst.current = map
      map.on('click', (e: any) => {
        const { lat: la, lng: ln } = e.latlng
        setLat(String(la))
        setLng(String(ln))
        if (markerRef.current) { markerRef.current.setLatLng(e.latlng) }
        else { markerRef.current = L.marker(e.latlng).addTo(map) }
      })
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude, longitude } = pos.coords
          map.setView([latitude, longitude], 14)
        })
      }
    })()
    return () => { if (map) map.remove() }
  }, [])

  // Initialize route plan map
  useEffect(() => {
    let map: any
    (async () => {
      const L: any = await import('leaflet')
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
      })
      // @ts-ignore
      L.Marker.prototype.options.icon = DefaultIcon
      map = L.map(planMapRef.current as HTMLDivElement).setView([27.2046, 77.4977], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
      planMapInst.current = map
      cpLayerRef.current = L.layerGroup().addTo(map)
      planPath.current = L.polyline([], { color: '#2563eb' }).addTo(map)
      map.on('click', (e: any) => {
        if (cpMode) {
          const name = prompt('Checkpoint name?') || ''
          const cp = { name, lat: e.latlng.lat, lng: e.latlng.lng }
          setCheckpoints(prev => {
            const next = [...prev, cp]
            // draw marker
            const m = L.marker([cp.lat, cp.lng]).bindPopup(name || 'Checkpoint')
            m.addTo(cpLayerRef.current)
            return next
          })
          setCpMode(false)
        } else {
          setPathPts(prev => {
            const next = [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]
            planPath.current.setLatLngs(next.map(p => [p.lat, p.lng]))
            return next
          })
        }
      })
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude, longitude } = pos.coords
          map.setView([latitude, longitude], 14)
        })
      }
    })()
    return () => { if (map) map.remove() }
  }, [])

  const create = async () => {
    if (!title.trim() || !when) return alert('Title and time required')
    const body: any = { title, when }
    if (lat) body.lat = parseFloat(lat)
    if (lng) body.lng = parseFloat(lng)
    if (userId) body.user_id = parseInt(userId)
    const r = await api('/api/admin/itineraries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { await refresh(); setTitle(''); setWhen(''); setLat(''); setLng(''); setUserId(''); alert('Itinerary added') } else alert('Failed')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white px-4 py-4">
      <Head><title>Admin Itineraries - Zentora</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Shield size={20} /> Itineraries</h1>
        <div className="flex items-center gap-2">
          <Link className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 flex items-center gap-1" href="/"><HomeIcon size={16} /> Home</Link>
          <Link className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700" href="/admin/dashboard">Back</Link>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 border rounded-xl border-neutral-200 dark:border-neutral-800">
          <div className="font-semibold mb-2 flex items-center gap-2"><CalendarPlus size={18} /> New Itinerary</div>
          <div className="grid gap-2 text-sm">
            <label className="grid gap-1">Title<input className="border rounded px-2 py-1 bg-transparent" value={title} onChange={e=>setTitle(e.target.value)} /></label>
            <label className="grid gap-1">When<input className="border rounded px-2 py-1 bg-transparent" type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} /></label>
            <div className="text-xs text-neutral-600">Pick location on the map (no manual lat/lng)</div>
            <div ref={mapRef} className="w-full h-56 rounded border border-neutral-200" />
            <div className="text-xs text-neutral-600">{lat && lng ? (<span><MapPin size={12} className="inline -mt-0.5" /> {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</span>) : 'No location chosen'}</div>
            <label className="grid gap-1">User ID (optional)<input className="border rounded px-2 py-1 bg-transparent" value={userId} onChange={e=>setUserId(e.target.value)} /></label>
            <button onClick={create} className="self-start mt-2 px-3 py-1.5 rounded bg-black text-white dark:bg-white dark:text-black">Create</button>
          </div>
        </div>
        <div className="p-4 border rounded-xl border-neutral-200 dark:border-neutral-800">
          <div className="font-semibold mb-2">Upcoming</div>
          {loading ? <div>Loading…</div> : (
            <ul className="text-sm space-y-2">
              {items.map(it => (
                <li key={it.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><MapPin size={14} /> {it.title} — {new Date(it.when).toLocaleString()} {it.lat && it.lng ? `· ${Number(it.lat).toFixed(3)},${Number(it.lng).toFixed(3)}` : ''} {it.user_id ? `· user ${it.user_id}` : ''}</span>
                </li>
              ))}
              {items.length === 0 && <li className="text-neutral-500">No itineraries</li>}
            </ul>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="p-4 border rounded-xl border-neutral-200 dark:border-neutral-800">
          <div className="font-semibold mb-2 flex items-center gap-2"><RouteIcon size={18} /> Route Plan (Map)</div>
          <div className="grid gap-2 text-sm">
            <label className="grid gap-1">Plan title<input className="border rounded px-2 py-1 bg-transparent" value={planTitle} onChange={e=>setPlanTitle(e.target.value)} /></label>
            <div className="flex items-center gap-2">
              <button onClick={()=>setCpMode(true)} className="px-2 py-1 rounded border border-neutral-300">Add checkpoint</button>
              <button onClick={()=>{
                setPathPts([]); setCheckpoints([])
                if (planPath.current) planPath.current.setLatLngs([])
                if (cpLayerRef.current) cpLayerRef.current.clearLayers()
              }} className="px-2 py-1 rounded border border-neutral-300 inline-flex items-center gap-1"><Eraser size={14}/>Clear</button>
              <span className={`text-xs ${cpMode? 'text-emerald-700':'text-neutral-500'}`}>{cpMode? 'Click on the map to add checkpoint…':'Click on map to add route points'}</span>
            </div>
            <div ref={planMapRef} className="w-full h-72 rounded border border-neutral-200" />
            <div className="text-xs text-neutral-600">{pathPts.length} route points · {checkpoints.length} checkpoints</div>
            <button onClick={async()=>{
              if (!planTitle.trim()) { alert('Enter a title'); return }
              if (pathPts.length < 2) { alert('Add at least 2 route points'); return }
              const body = { title: planTitle, data: { path: pathPts, checkpoints } }
              const r = await api('/api/admin/itinerary-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
              if (r.ok) { alert('Plan saved'); setPlanTitle(''); setPathPts([]); setCheckpoints([]); if (planPath.current) planPath.current.setLatLngs([]); if (cpLayerRef.current) cpLayerRef.current.clearLayers() } else alert('Failed to save plan')
            }} className="self-start px-3 py-1.5 rounded bg-black text-white">Save Plan</button>
          </div>
        </div>
        <AdminPlansList />
      </div>
    </div>
  )
}

function AdminPlansList() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    const r = await api('/api/admin/itinerary-plans')
    if (r.ok) setItems((await r.json()).items || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  const del = async (id: number) => {
    if (!confirm('Delete this plan?')) return
    const r = await api(`/api/admin/itinerary-plans/${id}`, { method: 'DELETE' })
    if (r.ok) load()
  }
  return (
    <div className="p-4 border rounded-xl border-neutral-200 dark:border-neutral-800">
      <div className="font-semibold mb-2">Saved Plans</div>
      {loading ? <div>Loading…</div> : (
        <ul className="text-sm space-y-2 max-h-80 overflow-auto">
          {items.map((p: any) => (
            <li key={p.id} className="flex items-center justify-between">
              <span>{p.title}</span>
              <span className="flex items-center gap-2">
                <Link className="underline text-xs" href={`/tourist/plan/${p.id}`}>Preview</Link>
                <button onClick={()=>del(p.id)} className="px-2 py-0.5 rounded border border-rose-300 text-rose-700 text-xs">Delete</button>
              </span>
            </li>
          ))}
          {items.length === 0 && <li className="text-neutral-500">No plans</li>}
        </ul>
      )}
    </div>
  )
}

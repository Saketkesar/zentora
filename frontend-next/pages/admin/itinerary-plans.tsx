import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../src/lib/api'
import { Shield, Route as RouteIcon, Flag, Home as HomeIcon, MapPin, Plus, Trash2, Save } from 'lucide-react'

const Planner = dynamic(async () => {
  return function Planner({ onSave }: { onSave: (title: string, data: any) => void }) {
    const ref = useRef<HTMLDivElement>(null)
    const [title, setTitle] = useState('Campus Tour')
    const [points, setPoints] = useState<Array<{lat:number,lng:number}>>([])
    const [checkpoints, setCheckpoints] = useState<Array<{name:string,lat:number,lng:number}>>([])
    const [mapObj, setMapObj] = useState<any>(null)
    const layerRef = useRef<any>(null)
    const cpMarkers = useRef<any[]>([])
    useEffect(() => {
      let map: any
      let poly: any
      ;(async () => {
        // @ts-ignore
        const L: any = await import('leaflet')
        const start: [number, number] = [29.908044, 77.925801] // Haridwar University gate area as provided
        map = L.map(ref.current as HTMLDivElement).setView(start, 17)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
        poly = L.polyline([], { color: '#2563eb', weight: 4 }).addTo(map)
        layerRef.current = poly
        setMapObj({ L, map, poly })
        map.on('click', (e: any) => {
          setPoints(p => [...p, { lat: e.latlng.lat, lng: e.latlng.lng }])
        })
      })()
      return () => { if (map) map.remove() }
    }, [])

    useEffect(() => {
      if (!mapObj || !layerRef.current) return
      const latlngs = points.map(p => [p.lat, p.lng])
      layerRef.current.setLatLngs(latlngs)
      // Clear existing editable markers
      if ((layerRef.current as any)._editMarkers) {
        for (const m of (layerRef.current as any)._editMarkers) m.remove()
      }
      ;(layerRef.current as any)._editMarkers = []
      // Add drag markers for each point
      for (let i=0;i<points.length;i++) {
        const p = points[i]
        // @ts-ignore
        const m = mapObj.L.marker([p.lat, p.lng], { draggable: true }).addTo(mapObj.map)
        m.on('drag', (ev: any) => {
          const { lat, lng } = ev.target.getLatLng()
          setPoints(cur => cur.map((pt, idx) => idx===i ? { lat, lng } : pt))
        })
        ;(layerRef.current as any)._editMarkers.push(m)
      }
    }, [points, mapObj])

    const addCheckpointAtCenter = () => {
      if (!mapObj) return
      const c = mapObj.map.getCenter()
      const cp = { name: `CP ${checkpoints.length+1}`, lat: c.lat, lng: c.lng }
      setCheckpoints(prev => [...prev, cp])
      // add marker
      // @ts-ignore
      const m = mapObj.L.marker([c.lat, c.lng], { title: cp.name }).addTo(mapObj.map)
      cpMarkers.current.push(m)
    }

    const save = () => {
      if (points.length < 2) { alert('Add at least two path points') ; return }
      const data = { path: points, checkpoints }
      onSave(title, data)
    }

  const clear = () => { setPoints([]); setCheckpoints([]); cpMarkers.current.forEach(m=>m.remove()); cpMarkers.current = []; if (layerRef.current && (layerRef.current as any)._editMarkers) { for (const m of (layerRef.current as any)._editMarkers) m.remove(); (layerRef.current as any)._editMarkers = [] } }

    return (
      <div className="grid gap-2">
        <div ref={ref} className="w-full h-80 rounded overflow-hidden border border-neutral-200 dark:border-neutral-800" />
        <div className="flex flex-wrap items-center gap-2">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Itinerary title" className="border rounded px-2 py-1 bg-transparent" />
          <button onClick={addCheckpointAtCenter} className="px-3 py-1.5 rounded border inline-flex items-center gap-1"><Flag size={16} /> Add checkpoint at center</button>
          <button onClick={clear} className="px-3 py-1.5 rounded border inline-flex items-center gap-1"><Trash2 size={16} /> Clear</button>
          <button onClick={save} className="px-3 py-1.5 rounded bg-blue-600 text-white dark:bg-blue-500 inline-flex items-center gap-1"><Save size={16} /> Save plan</button>
        </div>
        {/* Checkpoints list with rename/delete */}
        <div className="text-sm grid gap-1">
          {checkpoints.map((cp, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input className="border rounded px-2 py-0.5 bg-transparent" value={cp.name} onChange={e=>setCheckpoints(cs => cs.map((c,i)=> i===idx ? { ...c, name: e.target.value } : c))} />
              <button className="px-2 py-0.5 rounded border" onClick={()=> setCheckpoints(cs => cs.filter((_,i)=>i!==idx))}>Delete</button>
            </div>
          ))}
        </div>
        <div className="text-xs text-neutral-500">Tip: click on map to add path points. Pan/zoom to reposition, then add checkpoints at map center.</div>
      </div>
    )
  }
}, { ssr: false })

export default function AdminItineraryPlans() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const r = await api('/api/admin/itinerary-plans')
    if (r.ok) setItems((await r.json()).items || [])
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const savePlan = async (title: string, data: any) => {
    const r = await api('/api/admin/itinerary-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, data }) })
    if (r.ok) { await refresh(); alert('Plan saved') } else alert('Failed to save')
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this plan?')) return
    const r = await api(`/api/admin/itinerary-plans/${id}`, { method: 'DELETE' })
    if (r.ok) { await refresh() }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white px-4 py-4">
      <Head><title>Admin Itinerary Plans - Zentora</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Shield size={20} /> Itinerary Plans</h1>
        <div className="flex items-center gap-2">
          <Link className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 flex items-center gap-1" href="/"><HomeIcon size={16} /> Home</Link>
          <Link className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700" href="/admin/dashboard">Back</Link>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 border rounded-xl border-neutral-200 dark:border-neutral-800">
          <div className="font-semibold mb-2 flex items-center gap-2"><RouteIcon size={18} /> New Plan</div>
          <Planner onSave={savePlan} />
        </div>
        <div className="p-4 border rounded-xl border-neutral-200 dark:border-neutral-800">
          <div className="font-semibold mb-2">Existing Plans</div>
          {loading ? <div>Loading…</div> : (
            <ul className="text-sm space-y-2">
              {items.map(it => (
                <li key={it.id} className="p-2 rounded border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{it.title}</div>
                    <div className="text-xs text-neutral-500">Points: {it.data?.path?.length || 0} · Checkpoints: {it.data?.checkpoints?.length || 0}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/itinerary-plans/${it.id}`} className="px-2 py-1 rounded border inline-flex items-center gap-1">View</Link>
                    <button onClick={() => remove(it.id)} className="px-2 py-1 rounded border inline-flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                  </div>
                </li>
              ))}
              {items.length === 0 && <li className="text-neutral-500">No plans</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

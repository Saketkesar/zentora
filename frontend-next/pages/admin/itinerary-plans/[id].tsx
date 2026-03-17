import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { api } from '../../../src/lib/api'
import { MapPin, Route as RouteIcon, Download, ArrowLeft } from 'lucide-react'

const Viewer = dynamic(async () => {
  return function Viewer({ data }: { data: any }) {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      let map: any
      ;(async () => {
        // @ts-ignore
        const L: any = await import('leaflet')
        const start = data?.start ? [data.start.lat, data.start.lng] : [29.908044, 77.925801]
        map = L.map(ref.current as HTMLDivElement).setView(start, 16)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
        if (Array.isArray(data?.path) && data.path.length) {
          const latlngs = data.path.map((p:any) => [p.lat, p.lng])
          L.polyline(latlngs, { color: '#2563eb', weight: 4 }).addTo(map)
          L.marker(latlngs[0]).addTo(map).bindPopup('Start')
          L.marker(latlngs[latlngs.length-1]).addTo(map).bindPopup('End')
          map.fitBounds(latlngs)
        }
        for (const cp of (data?.checkpoints||[])) {
          L.marker([cp.lat, cp.lng]).addTo(map).bindTooltip(cp.name || 'Checkpoint')
        }
      })()
      return () => { if (map) map.remove() }
    }, [data])
    return <div ref={ref} className="w-full h-96 rounded border" />
  }
}, { ssr: false })

export default function AdminPlanView() {
  const router = useRouter()
  const { id } = router.query
  const [plan, setPlan] = useState<any>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const r = await api(`/api/admin/itinerary-plans/${id}`)
      if (r.ok) setPlan(await r.json())
    })()
  }, [id])

  const download = async (format: 'geojson'|'gpx') => {
    const r = await api(`/api/itinerary-plans/${id}.${format}`)
    if (!r.ok) return
    const data = await r.json()
    const blob = new Blob([
      format==='geojson' ? JSON.stringify(data) : data.gpx
    ], { type: format==='geojson' ? 'application/geo+json' : 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plan-${id}.${format==='geojson'?'geojson':'gpx'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white px-4 py-4">
      <Head><title>Plan Viewer</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold inline-flex items-center gap-2"><RouteIcon size={18} /> {plan?.title || 'Plan'}</h1>
        <Link className="underline text-sm inline-flex items-center gap-1" href="/admin/itinerary-plans"><ArrowLeft size={14} /> Back</Link>
      </header>
      {plan ? (
        <div className="grid gap-3">
          <Viewer data={plan.data} />
          <div className="flex items-center gap-2">
            <button onClick={()=>download('geojson')} className="px-3 py-1.5 rounded border inline-flex items-center gap-2"><Download size={16} /> GeoJSON</button>
            <button onClick={()=>download('gpx')} className="px-3 py-1.5 rounded border inline-flex items-center gap-2"><Download size={16} /> GPX</button>
          </div>
        </div>
      ) : (
        <div>Loading…</div>
      )}
    </div>
  )
}

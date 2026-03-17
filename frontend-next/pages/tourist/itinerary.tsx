import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { api } from '../../src/lib/api'
import { ArrowLeft } from 'lucide-react'

const Viewer = dynamic(async () => {
  return function Viewer({ data }: { data: any }) {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      let map: any
      ;(async () => {
        // @ts-ignore
        const L: any = await import('leaflet')
        const start = data?.start ? [data.start.lat, data.start.lng] : [29.908044, 77.925801]
        map = L.map(ref.current as HTMLDivElement).setView(start, 15)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
        if (Array.isArray(data?.path) && data.path.length) {
          const latlngs = data.path.map((p:any) => [p.lat, p.lng])
          L.polyline(latlngs, { color: '#2563eb', weight: 4 }).addTo(map)
          map.fitBounds(latlngs)
        }
        for (const cp of (data?.checkpoints||[])) {
          L.marker([cp.lat, cp.lng]).addTo(map).bindTooltip(cp.name || 'Checkpoint')
        }
      })()
      return () => { if (map) map.remove() }
    }, [data])
    return <div ref={ref} className="w-full h-[70vh] rounded border" />
  }
}, { ssr: false })

export default function TouristItinerary() {
  const router = useRouter()
  const { id } = router.query
  const [plan, setPlan] = useState<any>(null)

  useEffect(() => {
    ;(async () => {
      if (id) {
        const r = await api(`/api/itinerary-plans/${id}`)
        if (r.ok) setPlan(await r.json())
      } else {
        const r = await api('/api/itinerary-plans')
        if (r.ok) {
          const data = await r.json()
          const first = (data.items||[])[0]
          if (first) setPlan(first)
        }
      }
    })()
  }, [id])

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white px-4 py-4">
      <Head><title>Itinerary</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Itinerary</h1>
        <Link className="text-sm underline inline-flex items-center gap-1" href="/tourist/dashboard"><ArrowLeft size={14} /> Back</Link>
      </header>
      {plan ? <Viewer data={plan.data} /> : <div>Loading…</div>}
    </div>
  )
}

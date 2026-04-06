import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { api } from '../../src/lib/api'
import { ArrowLeft, MapPin } from 'lucide-react'

const Viewer = dynamic(async () => {
  return function Viewer({ data }: { data: any }) {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      let map: any
      ;(async () => {
        // @ts-ignore
        const L: any = await import('leaflet')
        const palette = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#3b82f6']
        const start = data?.start ? [data.start.lat, data.start.lng] : [29.908044, 77.925801]
        map = L.map(ref.current as HTMLDivElement).setView(start, 15)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
        const routeLayer = L.layerGroup().addTo(map)
        const checkpointLayer = L.layerGroup().addTo(map)
        if (Array.isArray(data?.path) && data.path.length) {
          const latlngs = data.path.map((p:any) => [p.lat, p.lng])
          L.polyline(latlngs, { color: '#0f172a', weight: 4, opacity: 0.7 }).addTo(map)
          data.path.forEach((p:any, idx:number) => {
            const color = palette[idx % palette.length]
            L.circleMarker([p.lat, p.lng], { radius: 6, color, fillColor: color, fillOpacity: 0.95, weight: 2 })
              .addTo(routeLayer)
              .bindTooltip(`Point ${idx + 1}`)
          })
          map.fitBounds(latlngs, { padding: [16, 16] })
        }
        for (const cp of (data?.checkpoints||[])) {
          L.circleMarker([cp.lat, cp.lng], { radius: 7, color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: 0.95, weight: 2 })
            .addTo(checkpointLayer)
            .bindTooltip(cp.name || 'Checkpoint')
        }
      })()
      return () => { if (map) map.remove() }
    }, [data])
    return <div ref={ref} className="w-full h-[60vh] rounded-2xl" />
  }
}, { ssr: false })

export default function TouristItinerary() {
  const router = useRouter()
  const { id } = router.query
  const [plan, setPlan] = useState<any>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const planId = Array.isArray(id) ? id[0] : id

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await api('/itinerary-plans')
      if (!r.ok) { setLoading(false); return }
      const data = await r.json()
      if (cancelled) return
      const list = data.items || []
      setPlans(list)
      if (!planId && list[0]) setPlan(list[0])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [planId])

  useEffect(() => {
    if (!planId) return
    ;(async () => {
      const r = await api(`/api/itinerary-plans/${planId}`)
      if (r.ok) setPlan(await r.json())
    })()
  }, [planId])

  const pathPoints = plan?.data?.path || []
  const checkpoints = plan?.data?.checkpoints || []
  const palette = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#3b82f6']

  return (
    <div className="min-h-screen text-black px-4 py-6">
      <Head><title>Itinerary</title></Head>
      <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold font-display">Itinerary</h1>
          <p className="text-sm text-neutral-600">Explore route plans and checkpoints from the admin panel.</p>
        </div>
        <Link className="text-sm underline inline-flex items-center gap-1" href="/tourist/dashboard"><ArrowLeft size={14} /> Back</Link>
      </header>

      {loading ? (
        <div>Loading…</div>
      ) : (!plan && plans.length === 0) ? (
        <div className="p-4 rounded-2xl border border-neutral-200 bg-white/80 text-sm">No itinerary yet.</div>
      ) : (
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
          <section className="border border-neutral-200 rounded-2xl bg-white/80 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.35)] overflow-hidden animate-slide-up">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <div className="font-semibold">{plan?.title || 'Route Plan'}</div>
              <div className="text-xs text-neutral-500 flex items-center gap-1"><MapPin size={12} /> {pathPoints.length} points</div>
            </div>
            <div className="p-3">
              {plan ? <Viewer data={plan.data} /> : <div className="text-sm text-neutral-500">Select a plan to view the route.</div>}
            </div>
          </section>

          <div className="grid gap-4">
            <section className="p-4 border border-neutral-200 rounded-2xl bg-white/80 animate-slide-up delay-100">
              <div className="font-semibold mb-2">Plans</div>
              <ul className="text-sm space-y-2 max-h-56 overflow-auto">
                {plans.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => setPlan(p)} className={`w-full text-left px-3 py-2 rounded-xl border ${plan?.id === p.id ? 'border-neutral-400 bg-neutral-50' : 'border-neutral-200 bg-white/80'}`}>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-neutral-500">Points: {p.data?.path?.length || 0} · Checkpoints: {p.data?.checkpoints?.length || 0}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="p-4 border border-neutral-200 rounded-2xl bg-white/80 animate-slide-up delay-200">
              <div className="font-semibold mb-2">Route Points</div>
              {pathPoints.length === 0 ? (
                <div className="text-sm text-neutral-500">No points yet.</div>
              ) : (
                <ul className="text-xs space-y-2 max-h-48 overflow-auto">
                  {pathPoints.map((p: any, idx: number) => (
                    <li key={`${p.lat}-${p.lng}-${idx}`} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette[idx % palette.length] }} />
                        Point {idx + 1}
                      </span>
                      <span className="text-neutral-500">{Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="p-4 border border-neutral-200 rounded-2xl bg-white/80 animate-slide-up delay-200">
              <div className="font-semibold mb-2">Checkpoints</div>
              {checkpoints.length === 0 ? (
                <div className="text-sm text-neutral-500">No checkpoints yet.</div>
              ) : (
                <ul className="text-xs space-y-2 max-h-40 overflow-auto">
                  {checkpoints.map((c: any, idx: number) => (
                    <li key={`${c.lat}-${c.lng}-${idx}`} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                        {c.name || `Checkpoint ${idx + 1}`}
                      </span>
                      <span className="text-neutral-500">{Number(c.lat).toFixed(5)}, {Number(c.lng).toFixed(5)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

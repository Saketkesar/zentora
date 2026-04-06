import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../src/lib/api'

export default function TouristPlanPage() {
  const router = useRouter()
  const { pid } = router.query
  const [plan, setPlan] = useState<any | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)
  const polyRef = useRef<any>(null)
  const cpLayerRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)
  const LRef = useRef<any>(null)
  const palette = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#3b82f6']

  useEffect(() => {
    if (!pid) return
    api(`/itinerary-plans/${pid}`).then(async r => {
      if (r.ok) setPlan(await r.json())
    })
  }, [pid])

  useEffect(() => {
    let map: any
    (async () => {
      const L: any = await import('leaflet')
      LRef.current = L
      map = L.map(mapRef.current as HTMLDivElement).setView([27.2046, 77.4977], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
      mapInst.current = map
      routeLayerRef.current = L.layerGroup().addTo(map)
      cpLayerRef.current = L.layerGroup().addTo(map)
      polyRef.current = L.polyline([], { color: '#2563eb' }).addTo(map)
    })()
    return () => { if (map) map.remove() }
  }, [])

  useEffect(() => {
    if (!plan || !mapInst.current || !LRef.current) return
    const L: any = LRef.current
    const pts = (plan.data?.path || []).map((p: any) => [p.lat, p.lng])
    if (routeLayerRef.current) routeLayerRef.current.clearLayers()
    if (cpLayerRef.current) cpLayerRef.current.clearLayers()
    if (pts.length >= 1) {
      polyRef.current.setLatLngs(pts)
      mapInst.current.fitBounds(polyRef.current.getBounds(), { padding: [20, 20] })
      ;(plan.data?.path || []).forEach((p: any, idx: number) => {
        const color = palette[idx % palette.length]
        L.circleMarker([p.lat, p.lng], { radius: 6, color, fillColor: color, fillOpacity: 0.95, weight: 2 })
          .addTo(routeLayerRef.current)
          .bindTooltip(`Point ${idx + 1}`)
      })
    }
    for (const c of (plan.data?.checkpoints || [])) {
      L.circleMarker([c.lat, c.lng], { radius: 7, color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: 0.95, weight: 2 })
        .addTo(cpLayerRef.current)
        .bindPopup(c.name || 'Checkpoint')
    }
  }, [plan])

  return (
    <div className="min-h-screen text-black px-4 py-6">
      <Head><title>{plan?.title || 'Plan'}</title></Head>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold font-display">{plan?.title || 'Plan'}</h1>
          <p className="text-sm text-neutral-600">Route points and checkpoints use different colors.</p>
        </div>
        <Link className="underline text-sm" href="/tourist/dashboard">Back</Link>
      </div>
      {!plan ? (
        <div>Loading…</div>
      ) : (
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
          <div className="p-3 border border-neutral-200 rounded-2xl bg-white/80 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.35)] animate-slide-up">
            <div ref={mapRef} className="w-full h-[60vh] rounded-xl" />
          </div>
          <div className="grid gap-4">
            <section className="p-4 border border-neutral-200 rounded-2xl bg-white/80 animate-slide-up delay-100">
              <div className="font-semibold mb-2">Route Points</div>
              {(plan.data?.path || []).length === 0 ? (
                <div className="text-sm text-neutral-500">No points yet.</div>
              ) : (
                <ul className="text-xs space-y-2 max-h-48 overflow-auto">
                  {(plan.data?.path || []).map((p: any, idx: number) => (
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
              {(plan.data?.checkpoints || []).length === 0 ? (
                <div className="text-sm text-neutral-500">No checkpoints yet.</div>
              ) : (
                <ul className="text-xs space-y-2 max-h-40 overflow-auto">
                  {(plan.data?.checkpoints || []).map((c: any, idx: number) => (
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

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

  useEffect(() => {
    if (!pid) return
    api(`/api/itinerary-plans/${pid}`).then(async r => {
      if (r.ok) setPlan(await r.json())
    })
  }, [pid])

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
      map = L.map(mapRef.current as HTMLDivElement).setView([27.2046, 77.4977], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
      mapInst.current = map
      cpLayerRef.current = L.layerGroup().addTo(map)
      polyRef.current = L.polyline([], { color: '#2563eb' }).addTo(map)
    })()
    return () => { if (map) map.remove() }
  }, [])

  useEffect(() => {
    if (!plan || !mapInst.current) return
    const L: any = (window as any).L || undefined
    // center on start if present
    const pts = (plan.data?.path || []).map((p: any) => [p.lat, p.lng])
    if (pts.length >= 1) {
      polyRef.current.setLatLngs(pts)
      mapInst.current.fitBounds(polyRef.current.getBounds(), { padding: [20, 20] })
    }
    // checkpoints
    for (const c of (plan.data?.checkpoints || [])) {
      const m = (L?.marker ? L.marker([c.lat, c.lng]) : null)
      if (m && cpLayerRef.current) { m.bindPopup(c.name || 'Checkpoint'); m.addTo(cpLayerRef.current) }
    }
  }, [plan])

  return (
    <div className="min-h-screen bg-white text-black px-3 py-4">
      <Head><title>{plan?.title || 'Plan'}</title></Head>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">{plan?.title || 'Plan'}</h1>
        <Link className="underline text-sm" href="/tourist/dashboard">Back</Link>
      </div>
      <div ref={mapRef} className="w-full h-[60vh] rounded border border-neutral-200" />
    </div>
  )
}

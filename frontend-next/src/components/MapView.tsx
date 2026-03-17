import { useEffect, useRef } from 'react'

export function MapView() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    let map: any = null
    let heat: any = null
    let dotGroup: any = null
    let refreshTimer: any = null
    ;(async () => {
      // Defer import to runtime; types may be missing in strict TS
      const L: any = await import('leaflet')
      if (cancelled) return
      // Try to import heat plugin
      try { await import('leaflet.heat') } catch {}
      if (cancelled) return
      // Fix default marker icons in bundlers
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      })
      // @ts-ignore
      L.Marker.prototype.options.icon = DefaultIcon
      // Initialize map only if container is present
      const container = ref.current
      if (!container || cancelled) return

      // React strict mode/dev hot-reload can leave stale leaflet id on the node.
      if ((container as any)._leaflet_id) {
        try { delete (container as any)._leaflet_id } catch {}
      }

      // @ts-ignore - CSS loaded via CDN
      map = L.map(container).setView([27.2046, 77.4977], 13)
      if (cancelled) {
        try { map.remove() } catch {}
        return
      }
      // Use OSM tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map)
      // Try geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude, longitude } = pos.coords
          map.setView([latitude, longitude], 14)
          L.marker([latitude, longitude]).addTo(map).bindPopup('You are here')
        })
      }
      // Plot incidents as simple circle overlays (admin flavor)
      try {
        const r = await fetch('/api/proxy/admin/incidents')
        if (r.ok) {
          const data = await r.json()
          for (const it of data.items || []) {
            if (it.lat && it.lng) {
              L.circle([it.lat, it.lng], { radius: 120, color: '#ef4444', weight: 1, fillColor: '#ef4444', fillOpacity: 0.25 }).addTo(map)
            }
          }
        }
      } catch {}

      // Draw geofences
      try {
        const r = await fetch('/api/proxy/admin/geofences')
        if (r.ok) {
          const data = await r.json()
          for (const g of data.items || []) {
            const color = g.kind === 'unsafe' ? '#ef4444' : '#10b981'
            L.circle([g.lat, g.lng], { radius: g.radius_m, color, weight: 1, fillColor: color, fillOpacity: 0.08 }).addTo(map).bindPopup(`${g.name} (${g.kind})`)
          }
        }
      } catch {}

      // Heatmap of user presence (public endpoint; tourists & admins can see)
      const renderHeat = async () => {
        try {
          const r = await fetch('/api/proxy/api/heat/users')
          if (!r.ok) return
          const data = await r.json()
          const pts = (data.points || [])
            .filter((p: any) => p.lat && p.lng)
            .map((p: any) => [p.lat, p.lng, 0.6]) // lat,lng,intensity
          if (heat) { try { heat.remove() } catch {} heat = null }
          if (dotGroup) { try { dotGroup.clearLayers() } catch {} } else { dotGroup = L.layerGroup().addTo(map) }
          if (pts.length > 0 && (L as any).heatLayer) {
            // @ts-ignore
            heat = (L as any).heatLayer(pts, { radius: 18, blur: 16, maxZoom: 17, minOpacity: 0.2, gradient: { 0.3: '#60a5fa', 0.6: '#f59e0b', 0.9: '#ef4444' } })
            heat.addTo(map)
          }
          for (const p of (data.points || [])) {
            L.circleMarker([p.lat, p.lng], { radius: 3, color: '#2563eb', weight: 0, fillColor: '#2563eb', fillOpacity: 0.8 }).addTo(dotGroup)
          }
        } catch {}
      }
      if (!cancelled) await renderHeat()
      // Periodically refresh every 30s
      try {
        refreshTimer = setInterval(() => {
          if (!cancelled) renderHeat()
        }, 30000)
      } catch {}
    })()
    return () => {
      cancelled = true
      try { if (refreshTimer) clearInterval(refreshTimer) } catch {}
      try { if (map) map.remove() } catch {}
      try {
        const container = ref.current
        if (container && (container as any)._leaflet_id) delete (container as any)._leaflet_id
      } catch {}
    }
  }, [])
  return <div ref={ref} className="w-full h-full rounded overflow-hidden" />
}

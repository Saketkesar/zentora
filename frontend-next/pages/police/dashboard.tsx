import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { api } from '../../src/lib/api'
import dynamic from 'next/dynamic'
const MapView = dynamic(() => import('../../src/components/MapView').then(m => m.MapView), { ssr: false })
import { ShieldAlert, Loader2, AlertTriangle, Map, Home as HomeIcon, LogOut, MapPin, Clock, Battery, Wifi } from 'lucide-react'

export default function PoliceDashboard() {
  const router = useRouter()
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    if (!token || role !== 'police') {
      router.replace('/police/login')
    }
  }, [])
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white px-4 py-4">
      <Head><title>Police Dashboard - Zentora</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2"><ShieldAlert size={20} /> Police Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 flex items-center gap-1" href="/"><HomeIcon size={16} /> Home</Link>
          <button onClick={()=>{ localStorage.removeItem('token'); location.href='/login' }} className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 flex items-center gap-1"><LogOut size={16} /> Logout</button>
        </div>
      </header>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-xl border-neutral-200 dark:border-neutral-800 card-hover slide-up">
          <div className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle size={18} /> SOS Panel</div>
          <SOSList />
        </div>
        <div className="p-0 border rounded-xl border-neutral-200 dark:border-neutral-800 card-hover fade-in overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="font-semibold flex items-center gap-2"><Map size={18} /> Live Map</div>
          </div>
          <div className="h-80"><MapView /></div>
        </div>
        <div className="p-4 border rounded-xl border-neutral-200 dark:border-neutral-800 card-hover fade-in">
          <div className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle size={18} /> Incidents</div>
          <IncidentsPanel />
        </div>
      </div>
    </div>
  )
}

function SOSList() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [focused, setFocused] = useState<any | null>(null)
  const [me, setMe] = useState<{lat:number,lng:number}|null>(null)
  useEffect(() => {
    api('/api/police/sos?status=open').then(async r => {
      if (r.ok) setItems((await r.json()).items)
    }).finally(() => setLoading(false))
    const loc = typeof window !== 'undefined' ? window.location : null
    if (!loc) return
    const wsProto = loc.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${wsProto}://${loc.host.replace(':3000', ':8001')}/ws/alerts`)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.event === 'alert_created' && msg.data?.type === 'sos') {
          setItems(prev => [msg.data, ...prev])
          if (typeof window !== 'undefined' && 'Notification' in window) {
            try { if (Notification.permission === 'granted') new Notification('Zentora', { body: `SOS #${msg.data?.id}` }) } catch {}
          }
        } else if (msg.event === 'alert_updated') {
          setItems(prev => prev.map(p => p.id === msg.data.id ? msg.data : p))
        }
      } catch {}
    }
    return () => { ws.close() }
  }, [])
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
    }
  }, [])
  const act = async (id: number, action: 'acknowledge'|'close') => {
    const r = await api(`/api/alerts/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    if (!r.ok) alert('Action failed')
  }
  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300"><Loader2 className="animate-spin" size={16} /> Loading…</div>
  }
  return (
    <div className="grid gap-2">
      <ul className="text-sm space-y-2 max-h-64 overflow-auto">
        {items.map(a => (
          <li key={a.id} className={`flex items-center justify-between gap-3 ${focused?.id===a.id?'bg-blue-50':''} p-2 rounded`}>
            <span className="flex items-center gap-3">
              <span className="font-medium">#{a.id}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${a.status==='open'?'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300':(a.status==='acknowledged'?'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300':'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300')}`}>{a.status}</span>
              {a.lat!=null && a.lng!=null && <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300"><MapPin size={14} /> {Number(a.lat).toFixed(3)},{Number(a.lng).toFixed(3)}</span>}
              {a.created_at && <span className="flex items-center gap-1 text-neutral-500"><Clock size={14} /> {new Date(a.created_at).toLocaleTimeString()}</span>}
              {a.battery!=null && <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300"><Battery size={14} /> {a.battery}%</span>}
              {a.network && <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300"><Wifi size={14} /> {a.network}</span>}
            </span>
            <div className="flex gap-2">
              {a.lat!=null && a.lng!=null && <button onClick={()=>setFocused(a)} className="px-2 py-0.5 text-xs rounded border border-neutral-300">Navigate</button>}
              {a.status === 'open' && <button onClick={()=>act(a.id,'acknowledge')} className="px-2 py-0.5 text-xs rounded bg-amber-600 text-white">Ack</button>}
              {a.status !== 'closed' && <button onClick={()=>act(a.id,'close')} className="px-2 py-0.5 text-xs rounded bg-emerald-600 text-white">Close</button>}
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-neutral-500">No SOS yet</li>
        )}
      </ul>
      <RoutePreview me={me} target={focused} />
    </div>
  )
}

function IncidentsPanel() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [focused, setFocused] = useState<any | null>(null)
  const [me, setMe] = useState<{lat:number,lng:number}|null>(null)

  useEffect(() => {
    // Load existing incidents
    api('/api/police/incidents').then(async r => { if (r.ok) setItems((await r.json()).items || []) }).finally(()=>setLoading(false))
    // Live updates via WS
    const loc = typeof window !== 'undefined' ? window.location : null
    if (!loc) return
    const wsProto = loc.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${wsProto}://${loc.host.replace(':3000', ':8001')}/ws/alerts`)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.event === 'incident_created') {
          setItems(prev => [msg.data, ...prev])
        }
      } catch {}
    }
    return () => { ws.close() }
  }, [])

  useEffect(() => {
    // capture officer location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      })
    }
  }, [])

  const haversine = (a:{lat:number,lng:number}, b:{lat:number,lng:number}) => {
    const toRad = (x:number)=> x*Math.PI/180
    const R=6371000
    const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng)
    const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2
    const c = 2*Math.atan2(Math.sqrt(s), Math.sqrt(1-s))
    return R*c
  }

  return (
    <div className="grid gap-3">
      {loading ? <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300"><Loader2 className="animate-spin" size={16} /> Loading…</div> : null}
      <div className="text-xs text-neutral-600">Click an incident to draw route and distance.</div>
      <ul className="text-sm space-y-2 max-h-56 overflow-auto">
        {items.map((it:any) => (
          <li key={it.id} className={`flex items-center justify-between ${focused?.id===it.id?'bg-blue-50':''} p-2 rounded`}> 
            <div className="flex items-center gap-3">
              <span className="font-medium">#{it.id}</span>
              {it.lat!=null && it.lng!=null && <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300"><MapPin size={14} /> {Number(it.lat).toFixed(3)},{Number(it.lng).toFixed(3)}</span>}
              {it.photo_url && (
                <a href={`/api/proxy${it.photo_url}`} target="_blank" rel="noreferrer" className="flex items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/proxy${it.photo_url}`} alt="attachment" className="w-10 h-10 rounded object-cover" />
                </a>
              )}
              <span className="text-neutral-600 truncate max-w-[12rem]">{it.description || 'No description'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">{it.created_at ? new Date(it.created_at).toLocaleTimeString() : ''}</span>
              <button onClick={()=>setFocused(it)} className="px-2 py-0.5 rounded border border-neutral-300 text-xs">Navigate</button>
            </div>
          </li>
        ))}
        {items.length===0 && <li className="text-neutral-500">No incidents</li>}
      </ul>
      <RoutePreview me={me} target={focused} />
    </div>
  )
}

function RoutePreview({ me, target }: { me: {lat:number,lng:number} | null, target: any }) {
  const ref = (useState(null) as any)[1]; // suppress unused React import warnings
  const mapRef = (useState<HTMLDivElement|null>(null) as any)[0]
  const [mapReady, setMapReady] = useState(false)
  const containerRef = (typeof window !== 'undefined') ? (document.createElement('div')) : null
  const divRef = useState<HTMLDivElement|null>(null)
  const _div = (divRef[0])
  const [id] = useState(()=>`map_${Math.random().toString(36).slice(2)}`)
  const holder = useState<any>(null)
  useEffect(() => { /* noop */ }, [])
  useEffect(() => {
    if (!target || !me) return
    (async () => {
      const L: any = await import('leaflet')
      const box = document.getElementById(id) as HTMLDivElement
      if (!box) return
      box.innerHTML = ''
      const map = L.map(box).setView([me.lat, me.lng], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
      const meMarker = L.marker([me.lat, me.lng]).addTo(map).bindPopup('You')
      const tgtMarker = L.marker([target.lat, target.lng]).addTo(map).bindPopup('Incident')
      const line = L.polyline([[me.lat, me.lng], [target.lat, target.lng]], { color: '#2563eb' }).addTo(map)
      map.fitBounds(line.getBounds(), { padding: [20,20] })
      const dist = Math.round((Math.acos(Math.sin(me.lat * Math.PI/180) * Math.sin(target.lat * Math.PI/180) + Math.cos(me.lat * Math.PI/180) * Math.cos(target.lat * Math.PI/180) * Math.cos((target.lng - me.lng) * Math.PI/180)) * 6371000))
      L.circleMarker([me.lat, me.lng], { radius: 0 }).addTo(map).bindTooltip(`Distance: ${dist} m`, { permanent: true, direction: 'center', className: 'px-2 py-1 rounded bg-white text-black border' }).openTooltip()
    })()
  }, [target?.id, me?.lat, me?.lng])
  return (
    <div>
      {!me || !target ? <div className="text-xs text-neutral-500">Pick an incident to preview route and distance.</div> : (
        <div id={id} className="w-full h-64 rounded border border-neutral-200" />
      )}
    </div>
  )
}

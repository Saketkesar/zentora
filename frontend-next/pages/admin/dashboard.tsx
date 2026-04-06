import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { API_BASE, api } from '../../src/lib/api'
import { Shield, Loader2, BellRing, Map, Gauge, Home as HomeIcon, LogOut, MapPin, Clock, Battery, Wifi, Users, Activity, CreditCard, UserCheck, Calendar, AlertTriangle } from 'lucide-react'
import dynamic from 'next/dynamic'
const MapView = dynamic(() => import('../../src/components/MapView').then(m => m.MapView), { ssr: false })
import { AppHeader } from '../../src/components/AppHeader'

export default function AdminDashboard() {
  const router = useRouter()
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    if (!token || role !== 'admin') {
      router.replace('/admin/login')
    }
  }, [])
  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-black px-4 py-4">
      <Head><title>Admin Dashboard - Zentora</title></Head>
      <AppHeader title="Admin Dashboard" role="admin" />
      <StatsCards />
      <div className="grid md:grid-cols-3 gap-4 mb-4">
  <div className="p-0 rounded-xl bg-white border-2 border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b-2 border-neutral-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="font-bold flex items-center gap-2 text-lg"><Map className="text-blue-600" size={20} /> Live Map</div>
              <div className="flex items-center gap-3">
                <Link className="px-3 py-1 rounded-lg text-xs font-medium border border-neutral-300 hover:bg-neutral-50 transition-colors inline-flex items-center gap-1" href="/admin/itineraries"><Calendar size={14} /> Itineraries</Link>
                <Link className="px-3 py-1 rounded-lg text-xs font-medium border border-neutral-300 hover:bg-neutral-50 transition-colors inline-flex items-center gap-1" href="/admin/kyc"><UserCheck size={14} /> KYC</Link>
              </div>
          </div>
          <div className="h-80">
            <MapView />
          </div>
        </div>
  <div className="p-5 rounded-xl bg-white border-2 border-neutral-200 shadow-sm">
          <div className="font-bold mb-3 flex items-center gap-2 text-lg"><BellRing className="text-red-600" size={20} /> Recent Alerts</div>
          <AdminAlerts />
        </div>
  <div className="p-5 rounded-xl bg-white border-2 border-neutral-200 shadow-sm">
          <div className="font-bold flex items-center gap-2 mb-3 text-lg"><Gauge className="text-purple-600" size={20} /> Broadcast</div>
          <AdminNotify />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
  <div className="p-5 rounded-xl bg-white border-2 border-neutral-200 shadow-sm">
          <div className="font-bold mb-3 flex items-center gap-2 text-lg"><Activity className="text-green-600" size={20} /> Active (5m)</div>
          <ActiveUsers />
        </div>
  <div className="p-5 rounded-xl bg-white border-2 border-neutral-200 shadow-sm md:col-span-2">
          <div className="font-bold mb-3 flex items-center gap-2 text-lg"><CreditCard className="text-blue-600" size={20} /> Recent IDs</div>
          <RecentIds />
        </div>
        <div className="p-5 rounded-xl bg-white border-2 border-neutral-200 shadow-sm md:col-span-3">
          <div className="font-bold mb-3 flex items-center gap-2 text-lg"><AlertTriangle className="text-amber-600" size={20} /> Incidents</div>
          <AdminIncidents />
        </div>
      </div>
    </div>
  )
}

function StatsCards() {
  const [stats, setStats] = useState<any | null>(null)
  useEffect(() => {
    api('/admin/stats').then(async r => { if (r.ok) setStats(await r.json()) })
  }, [])
  const Card = ({ title, value, icon }: { title: string, value: any, icon: React.ReactNode }) => (
    <div className="p-5 rounded-xl bg-white border-2 border-neutral-200 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
      <div>
        <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">{title}</div>
        <div className="text-3xl font-bold text-black mt-2">{value ?? '—'}</div>
      </div>
      <div className="text-blue-600 opacity-20">{icon}</div>
    </div>
  )
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      <Card title="Users" value={stats?.total_users} icon={<Users size={32} />} />
      <Card title="Tourists" value={stats?.total_tourists} icon={<Users size={32} />} />
      <Card title="Verified" value={stats?.verified_tourists} icon={<Shield size={32} />} />
  <Card title="IDs" value={stats?.total_ids} icon={<CreditCard size={32} />} />
      <Card title={`Active (${stats?.active_window_minutes || 5}m)`} value={stats?.active_users_5m} icon={<Activity size={32} />} />
      <Card title="Pending KYC" value={stats?.pending_kyc} icon={<BellRing size={32} />} />
    </div>
  )
}

function AdminAlerts() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [focused, setFocused] = useState<any | null>(null)
  const [me, setMe] = useState<{lat:number,lng:number}|null>(null)
  useEffect(() => {
    api('/admin/alerts').then(async r => {
      if (r.ok) setItems((await r.json()).items)
    }).finally(() => setLoading(false))
    // WebSocket for live alerts
    const loc = typeof window !== 'undefined' ? window.location : null
    if (!loc) return
    const wsProto = loc.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${wsProto}://${loc.host.replace(':3000', ':8001')}/ws/alerts`)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.event === 'alert_created') {
          setItems(prev => [msg.data, ...prev].slice(0, 50))
          if (typeof window !== 'undefined' && 'Notification' in window) {
            try { if (Notification.permission === 'granted') new Notification('Zentora', { body: `New ${msg.data?.type} alert #${msg.data?.id}` }) } catch {}
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
    return <div className="flex items-center gap-2 text-sm text-neutral-600"><Loader2 className="animate-spin" size={16} /> Loading…</div>
  }
  return (
    <div className="grid gap-2">
      <ul className="text-sm space-y-2 max-h-64 overflow-auto">
        {items.map(a => (
          <li key={a.id} className={`flex items-center justify-between gap-3 ${focused?.id===a.id?'bg-blue-50':''} p-2 rounded`}>
            <span className="flex items-center gap-3">
              <span className="font-medium">#{a.id}</span>
              <span>{a.type}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${a.status==='open'?'bg-rose-100 text-rose-700':(a.status==='acknowledged'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700')}`}>{a.status}</span>
              {a.lat!=null && a.lng!=null && <span className="flex items-center gap-1 text-neutral-600"><MapPin size={14} /> {Number(a.lat).toFixed(3)},{Number(a.lng).toFixed(3)}</span>}
              {a.created_at && <span className="flex items-center gap-1 text-neutral-500"><Clock size={14} /> {new Date(a.created_at).toLocaleTimeString()}</span>}
              {a.battery!=null && <span className="flex items-center gap-1 text-neutral-600"><Battery size={14} /> {a.battery}%</span>}
              {a.network && <span className="flex items-center gap-1 text-neutral-600"><Wifi size={14} /> {a.network}</span>}
            </span>
            <div className="flex gap-2">
              {a.lat!=null && a.lng!=null && <button onClick={()=>setFocused(a)} className="px-2 py-0.5 text-xs rounded border border-neutral-300">Navigate</button>}
              {a.status === 'open' && <button onClick={()=>act(a.id,'acknowledge')} className="px-2 py-0.5 text-xs rounded bg-amber-600 text-white">Ack</button>}
              {a.status !== 'closed' && <button onClick={()=>act(a.id,'close')} className="px-2 py-0.5 text-xs rounded bg-emerald-600 text-white">Close</button>}
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-neutral-500 flex items-center gap-2"><BellRing size={14} /> No alerts yet</li>
        )}
      </ul>
      <RoutePreview me={me} target={focused} />
    </div>
  )
}

function AdminIncidents() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  useEffect(() => {
    api('/admin/incidents').then(async r => {
      if (r.ok) setItems((await r.json()).items)
    }).finally(() => setLoading(false))
    const loc = typeof window !== 'undefined' ? window.location : null
    if (!loc) return
    const wsProto = loc.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${wsProto}://${loc.host.replace(':3000', ':8001')}/ws/alerts`)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.event === 'incident_created') {
          setItems(prev => [msg.data, ...prev].slice(0, 50))
        }
      } catch {}
    }
    return () => { ws.close() }
  }, [])
  if (loading) return <div className="flex items-center gap-2 text-sm text-neutral-600"><Loader2 className="animate-spin" size={16} /> Loading…</div>
  return (
    <ul className="text-sm space-y-2 max-h-64 overflow-auto">
      {items.map((it) => (
        <li key={it.id} className="flex items-center justify-between p-2 rounded border border-neutral-200">
          <div className="flex items-center gap-3">
            <span className="font-medium">#{it.id}</span>
            {it.lat!=null && it.lng!=null && (
              <span className="text-xs text-neutral-500">{Number(it.lat).toFixed(3)}, {Number(it.lng).toFixed(3)}</span>
            )}
            <span className="text-neutral-700 truncate max-w-[12rem]">{it.description || 'No description'}</span>
            {it.photo_url && (
              <a href={`/api/proxy${it.photo_url}`} target="_blank" rel="noreferrer" className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/proxy${it.photo_url}`} alt="attachment" className="w-10 h-10 rounded object-cover" />
              </a>
            )}
          </div>
          <span className="text-xs text-neutral-500">{it.created_at ? new Date(it.created_at).toLocaleTimeString() : ''}</span>
        </li>
      ))}
      {items.length === 0 && <li className="text-neutral-500">No incidents</li>}
    </ul>
  )
}

function RoutePreview({ me, target }: { me: {lat:number,lng:number} | null, target: any }) {
  const [id] = useState(()=>`map_${Math.random().toString(36).slice(2)}`)
  const mapRef = useState<any>(null)[0]
  useEffect(() => {
    if (!target || !me) return
    let cancelled = false
    let localMap: any = null;
    (async () => {
      const L: any = await import('leaflet')
      if (cancelled) return
      const box = document.getElementById(id) as HTMLDivElement
      if (!box) return

      // Clear previous instance before creating a new map on the same node.
      try {
        const prev: any = (box as any)._leaflet_map_instance
        if (prev) prev.remove()
      } catch {}
      if ((box as any)._leaflet_id) {
        try { delete (box as any)._leaflet_id } catch {}
      }

      localMap = L.map(box).setView([me.lat, me.lng], 13)
      ;(box as any)._leaflet_map_instance = localMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(localMap)
      L.marker([me.lat, me.lng]).addTo(localMap).bindPopup('You')
      L.marker([target.lat, target.lng]).addTo(localMap).bindPopup('Target')
      const line = L.polyline([[me.lat, me.lng], [target.lat, target.lng]], { color: '#2563eb' }).addTo(localMap)
      localMap.fitBounds(line.getBounds(), { padding: [20,20] })
      const dist = Math.round((Math.acos(Math.sin(me.lat * Math.PI/180) * Math.sin(target.lat * Math.PI/180) + Math.cos(me.lat * Math.PI/180) * Math.cos(target.lat * Math.PI/180) * Math.cos((target.lng - me.lng) * Math.PI/180)) * 6371000))
      L.circleMarker([me.lat, me.lng], { radius: 0 }).addTo(localMap).bindTooltip(`Distance: ${dist} m`, { permanent: true, direction: 'center', className: 'px-2 py-1 rounded bg-white text-black border' }).openTooltip()
    })()

    return () => {
      cancelled = true
      const box = document.getElementById(id) as HTMLDivElement | null
      try {
        const prev: any = box ? (box as any)._leaflet_map_instance : null
        if (prev) prev.remove()
        if (box) {
          ;(box as any)._leaflet_map_instance = null
          if ((box as any)._leaflet_id) delete (box as any)._leaflet_id
        }
      } catch {}
      try { if (localMap) localMap.remove() } catch {}
    }
  }, [target?.id, me?.lat, me?.lng])
  return (
    <div>
      {!me || !target ? <div className="text-xs text-neutral-500">Pick an alert to preview route and distance.</div> : (
        <div id={id} className="w-full h-64 rounded border border-neutral-200" />
      )}
    </div>
  )
}

function ActiveUsers() {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => {
    const load = async () => {
      const r = await api('/admin/users/locations')
      if (r.ok) {
        const data = await r.json()
        setItems(data.items || [])
      }
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])
  if (items.length === 0) return <div className="text-sm text-neutral-500">No active users in the last snapshot.</div>
  return (
    <ul className="text-sm space-y-2 max-h-64 overflow-auto">
      {items.map((u) => (
        <li key={u.user_id} className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users size={14} />
            <span>User {u.user_id}</span>
          </span>
          <span className="text-xs text-neutral-500">{new Date(u.updated_at).toLocaleTimeString()}</span>
        </li>
      ))}
    </ul>
  )
}

function RecentIds() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [toast, setToast] = useState<string | null>(null)
  const load = async () => {
    setLoading(true)
    try {
      const r = await api('/admin/tourist-ids')
      if (r.ok) {
        const data = await r.json()
        setItems(data.items || [])
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const del = async (id: number) => {
    if (!confirm('Delete this Tourist ID?')) return
    const r = await api(`/admin/tourist-ids/${id}`, { method: 'DELETE' })
    if (r.ok) { load(); setToast('Tourist ID deleted'); setTimeout(()=>setToast(null), 2000) }
  }
  if (loading) return <div className="flex items-center gap-2 text-sm text-neutral-600"><Loader2 className="animate-spin" size={16} /> Loading…</div>
  return (
    <div className="relative">
      {toast && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded bg-black text-white text-xs shadow">{toast}</div>
      )}
      <ul className="text-sm space-y-2 max-h-64 overflow-auto">
      {items.map(it => (
        <li key={it.id} className="flex items-center justify-between p-2 rounded border border-neutral-200">
          <div className="flex items-center gap-3">
            {it.qr_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/proxy${it.qr_url}`} alt="qr" className="w-10 h-10 bg-neutral-200 rounded" loading="lazy" onError={(e)=>{ const t=e.target as HTMLImageElement; t.onerror=null; t.src='/placeholder-qr.png' }} />
            )}
            <div>
              <div className="font-mono text-xs">{String(it.uuid).slice(0,8)}…</div>
              <div className="text-xs text-neutral-500">{it.valid_from?.replace('T',' ').replace('Z','')} → {it.valid_to?.replace('T',' ').replace('Z','')}</div>
            </div>
          </div>
          <button onClick={()=>del(it.id)} className="px-2 py-1 rounded border border-red-300 text-red-600">Delete</button>
        </li>
      ))}
      {items.length === 0 && <li className="text-neutral-500">No IDs yet</li>}
      </ul>
    </div>
  )
}

function AdminNotify() {
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const send = async () => {
    if (!msg.trim()) return
    setSending(true)
    try {
      const r = await api('/admin/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) })
      if (r.ok) { setMsg(''); alert('Sent') } else alert('Failed')
    } finally { setSending(false) }
  }
  return (
    <div className="grid gap-2">
      <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Message to all tourists" className="w-full h-24 border rounded px-2 py-1 bg-transparent" />
      <button disabled={sending} onClick={send} className="self-start px-3 py-1.5 rounded bg-black text-white">{sending? 'Sending…' : 'Send'}</button>
    </div>
  )
}

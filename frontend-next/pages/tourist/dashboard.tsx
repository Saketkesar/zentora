import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useI18n } from '../../src/i18n/useI18n'
import dynamic from 'next/dynamic'
import { Home, Map, Calendar, Bell, User, LogOut, Printer, ArrowLeft } from 'lucide-react'
import { api, API_BASE } from '../../src/lib/api'
import dynamicCard from 'next/dynamic'
const TouristIdCard = dynamicCard(() => import('../../src/components/TouristIdCard').then(m => m.TouristIdCard), { ssr: false })
import { AppHeader } from '../../src/components/AppHeader'
import { TouristBottomNav } from '../../src/components/TouristBottomNav'

const SOSButton = dynamic(() => import('../../src/components/SOSButton').then(m => m.SOSButton), { ssr: false })
const MapView = dynamic(() => import('../../src/components/MapView').then(m => m.MapView), { ssr: false })

export default function TouristDashboard() {
  const { t } = useI18n()
  const [profile, setProfile] = useState<any>(null)
  const [itins, setItins] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const router = useRouter()
  const [notifAllowed, setNotifAllowed] = useState<boolean>(false)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    // Simple client-side guard: redirect to login if no token
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      if (!token) {
        router.replace('/login')
        return
      }
    }
    api('/tourist/me').then(async r => {
      if (r.ok) setProfile(await r.json())
    }).catch(() => {})
    api('/tourist/itinerary').then(async r => {
      if (r.ok) {
        const d = await r.json()
        setItins(d.items || [])
      }
    }).catch(() => {})
    // Load public itinerary plans for map routes
    api('/itinerary-plans').then(async r => {
      if (r.ok) {
        const d = await r.json()
        setPlans(d.items || [])
      }
    }).catch(()=>{})
    // flash banner from query param
    const sp = new URLSearchParams(window.location.search)
    const f = sp.get('flash')
    if (f) {
      setFlash(f)
      // remove query param without reload
      const url = new URL(window.location.href)
      url.searchParams.delete('flash')
      window.history.replaceState({}, '', url.toString())
    }
    // Request location permission
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(()=>{}, ()=>{})
    }
    // Request notification permission (non-blocking)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          const result: any = Notification.requestPermission && Notification.requestPermission()
          if (result && typeof (result as any).then === 'function') {
            ;(result as any).catch(()=>{})
          }
        } catch {}
      }
      setNotifAllowed(Notification.permission === 'granted')
    }
    // Geolocation heartbeat to backend every 30s (if allowed)
    let hb: any
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const send = () => {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude, longitude } = pos.coords
          api('/locations/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: latitude, lng: longitude }) })
        })
      }
      send()
      hb = setInterval(send, 30000)
    }
    // WebSocket notifications for broadcasts
    let ws: WebSocket | null = null
    try {
      const loc = typeof window !== 'undefined' ? window.location : null
      if (loc) {
        const wsProto = loc.protocol === 'https:' ? 'wss' : 'ws'
        ws = new WebSocket(`${wsProto}://${loc.host.replace(':3000', ':8001')}/ws/alerts`)
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data)
            if (msg.event === 'notice' && msg.data?.message) {
              if ('Notification' in window) {
                if (Notification.permission === 'granted') new Notification('Zentora', { body: msg.data.message })
              }
            }
          } catch {}
        }
      }
    } catch {}
    return () => { if (hb) clearInterval(hb); if (ws) ws.close() }
  }, [])

  return (
  <div className="min-h-screen text-black px-3 sm:px-4 pb-28 pt-3 max-w-md mx-auto bg-white">
      <Head><title>{t('tourist.title')}</title></Head>
    <AppHeader title={t('tourist.header')} role="tourist" />
      {flash === 'kyc_submitted' && (
        <div className="mb-3 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800">
          Verification submitted — please visit the counter with your personal ID.
        </div>
      )}
      

      <section className="grid gap-4">
  <div className="p-4 border rounded-2xl border-neutral-200 shadow-sm glass bg-white">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">{t('tourist.badge')}</div>
          <div className="font-medium mb-2 flex items-center gap-2">
            <span>{profile?.tourist_id ?? t('tourist.notVerified')}</span>
            {profile?.kyc_status && (
              <span className={`px-2 py-0.5 rounded text-xs ${profile.kyc_status==='approved'?'bg-emerald-100 text-emerald-700':(profile.kyc_status==='pending'?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700')}`}>{profile.kyc_status}</span>
            )}
          </div>
          {profile?.qr_url ? (
            <div className="mt-2">
              <TouristIdCard
                name={profile?.name}
                maskedId={null}
                profilePhotoUrl={profile?.profile_photo_url ? `/api/proxy${profile.profile_photo_url}` : null}
                qrUrl={`/api/proxy${profile.qr_url}`}
                validFrom={profile?.valid_from}
                validTo={profile?.valid_to}
              />
              <div className="mt-2 text-right">
                <Link href="/tourist/id/print" className="text-sm underline inline-flex items-center gap-1"><Printer size={14} /> Print ID</Link>
              </div>
            </div>
          ) : profile?.kyc_status === 'pending' ? (
            <div className="mt-2 text-sm text-amber-700">Verification submitted — awaiting review at the counter.</div>
          ) : (
            <Link className="px-3 py-1.5 rounded bg-blue-600 text-white dark:bg-blue-500 inline-flex items-center gap-2 text-sm" href="/tourist/kyc">Start verification</Link>
          )}
        </div>

        {/* SOS: Use a single rectangular bar for all viewports */}
        <div className="mt-2">
          <SOSButton variant="bar" />
        </div>

  <div className="p-4 border rounded-2xl border-neutral-200 shadow-sm glass bg-white">
          <div className="text-sm font-medium mb-2">{t('tourist.mapSnapshot')}</div>
          <div className="h-56 rounded overflow-hidden bg-neutral-900">
            <MapView />
          </div>
          <Link href="/tourist/map" className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white dark:bg-blue-500 text-sm">Open map</Link>
        </div>

  <div className="p-4 border rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900/60 backdrop-blur">
          <div className="text-sm font-medium mb-2">{t('tourist.itinerary')}</div>
          {itins.length === 0 ? (
            <p className="text-sm text-neutral-500">{t('tourist.itineraryEmpty')}</p>
          ) : (
            <ul className="text-sm space-y-2">
              {itins.map((it) => (
                <li key={it.id} className="flex items-center justify-between">
                  <span>{it.title}</span>
                  <span className="text-xs text-neutral-500">{new Date(it.when).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

  <div className="p-4 border rounded-2xl border-neutral-200 shadow-sm glass bg-white">
          <div className="text-sm font-medium mb-2">Plans</div>
          {plans.length === 0 ? (
            <p className="text-sm text-neutral-500">No plans yet</p>
          ) : (
            <ul className="text-sm space-y-2">
              {plans.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>{p.title}</span>
                  <Link href={`/tourist/plan/${p.id}`} className="underline text-xs">Open</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {!notifAllowed && (
        <section className="mt-4 p-4 border rounded-xl border-neutral-200">
          <div className="text-sm font-medium mb-1">Notifications</div>
          <p className="text-sm text-neutral-600 mb-2">Enable notifications to receive important updates.</p>
          <button onClick={() => { if ('Notification' in window && Notification.requestPermission) { const r: any = Notification.requestPermission(); if (r && typeof r.then === 'function') { r.then((p:any)=> setNotifAllowed(p==='granted')).catch(()=>{}) } else { setTimeout(()=>{ try { setNotifAllowed(Notification.permission==='granted') } catch {} }, 0) } } }} className="px-3 py-1.5 rounded border border-neutral-300 text-sm">Enable notifications</button>
        </section>
      )}

      <TouristBottomNav />
    </div>
  )
}

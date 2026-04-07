import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, API_BASE } from '../../src/lib/api'
import { Avatar } from '../../src/components/Avatar'
import { TouristBottomNav } from '../../src/components/TouristBottomNav'
import { Loader2, Wifi, Save } from 'lucide-react'

export default function TouristProfile() {
  const [me, setMe] = useState<any>(null)
  const [rfidLoading, setRfidLoading] = useState(false)
  const [rfidMessage, setRfidMessage] = useState<string | null>(null)
  
  useEffect(() => { (async () => { const r = await api('/tourist/me'); if (r.ok) setMe(await r.json()) })() }, [])
  
  const handleRfidRead = async () => {
    const uuid = prompt('Enter your Tourist UUID:')
    if (!uuid) return
    setRfidLoading(true)
    setRfidMessage(null)
    try {
      const r = await api('/rfid/read/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourist_uuid: uuid, tag_id: uuid })
      })
      const data = await r.json()
      if (r.ok) {
        setRfidMessage(`✅ RFID Read Success: ${data.message || 'Tag verified'}`)
      } else {
        setRfidMessage(`❌ Error: ${data.detail || 'Failed to read RFID'}`)
      }
    } catch (e) {
      setRfidMessage(`❌ Error: ${(e as any).message}`)
    } finally {
      setRfidLoading(false)
      setTimeout(() => setRfidMessage(null), 5000)
    }
  }
  
  const handleRfidWrite = async () => {
    const uuid = prompt('Enter your Tourist UUID:')
    if (!uuid) return
    setRfidLoading(true)
    setRfidMessage(null)
    try {
      const r = await api(`/rfid/write/complete?uuid=${encodeURIComponent(uuid)}`, {
        method: 'POST'
      })
      const data = await r.json()
      if (r.ok) {
        setRfidMessage(`✅ RFID Write Success: ${data.message || 'Tag written'}`)
      } else {
        setRfidMessage(`❌ Error: ${data.detail || 'Failed to write RFID'}`)
      }
    } catch (e) {
      setRfidMessage(`❌ Error: ${(e as any).message}`)
    } finally {
      setRfidLoading(false)
      setTimeout(() => setRfidMessage(null), 5000)
    }
  }
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-black dark:text-white px-4 py-4 pb-32 max-w-md mx-auto">
      <Head><title>Profile - Tourist</title></Head>
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Profile</h1>
        <Link href="/tourist/dashboard" className="text-sm underline">Back</Link>
      </header>
      <div className="grid gap-3">
        <div className="p-4 border rounded-2xl border-neutral-200 dark:border-neutral-800 flex items-center gap-3 bg-white dark:bg-neutral-900/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Avatar src={me?.profile_photo_url ? `/api/proxy${me.profile_photo_url}` : undefined} size={56} className="w-14 h-14" alt="profile" />
          <div>
            <div className="font-medium">{me?.name || '—'}</div>
            <div className="text-xs text-neutral-500">ID Verification: <span className={`px-2 py-0.5 rounded text-xs ${me?.kyc_status==='approved'?'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300':(me?.kyc_status==='pending'?'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300':'bg-neutral-200 dark:bg-neutral-800')}`}>{me?.kyc_status || '—'}</span></div>
          </div>
        </div>
  <div className="p-4 border rounded-2xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60">
          <div className="text-sm text-neutral-600 dark:text-neutral-300">Tourist ID</div>
          <div className="font-mono text-xs">{me?.tourist_id || '—'}</div>
          {me?.valid_from && me?.valid_to && (
            <div className="text-xs text-neutral-500">{me.valid_from.replace('T',' ').replace('Z','')} → {me.valid_to.replace('T',' ').replace('Z','')}</div>
          )}
          {me?.qr_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/proxy${me.qr_url}`} alt="qr" className="w-32 h-32 mt-2" />
          )}
        </div>
        
        {/* RFID Controls */}
        <div className="p-4 border rounded-2xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Wifi size={16} /> RFID Settings</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleRfidRead}
              disabled={rfidLoading}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {rfidLoading ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
              Read RFID
            </button>
            <button
              onClick={handleRfidWrite}
              disabled={rfidLoading}
              className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {rfidLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Write RFID
            </button>
          </div>
          {rfidMessage && (
            <div className="mt-2 p-2 rounded text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
              {rfidMessage}
            </div>
          )}
        </div>
      </div>
      <TouristBottomNav />
    </div>
  )
}

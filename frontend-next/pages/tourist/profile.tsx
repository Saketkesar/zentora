import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, API_BASE } from '../../src/lib/api'
import { Avatar } from '../../src/components/Avatar'

export default function TouristProfile() {
  const [me, setMe] = useState<any>(null)
  useEffect(() => { (async () => { const r = await api('/api/tourist/me'); if (r.ok) setMe(await r.json()) })() }, [])
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-black dark:text-white px-4 py-4 max-w-md mx-auto">
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
            <div className="text-xs text-neutral-500">Aadhaar: <span className={`px-2 py-0.5 rounded text-xs ${me?.kyc_status==='approved'?'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300':(me?.kyc_status==='pending'?'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300':'bg-neutral-200 dark:bg-neutral-800')}`}>{me?.kyc_status || '—'}</span></div>
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
      </div>
    </div>
  )
}

import Head from 'next/head'
import { useEffect, useState } from 'react'
import { api, API_BASE } from '../../../src/lib/api'

export default function PrintIdPage() {
  const [profile, setProfile] = useState<any>(null)
  useEffect(() => { api('/api/tourist/me').then(async r => { if (r.ok) setProfile(await r.json()) }) }, [])
  return (
    <div>
      <Head>
        <title>Print Tourist ID</title>
        <style>{`
          @page { size: 86mm 54mm; margin: 0; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          .card { width: 86mm; height: 54mm; }
        `}</style>
      </Head>
      <div className="min-h-screen bg-neutral-100 dark:bg-black text-black dark:text-white p-4">
        <div className="card bg-white dark:bg-neutral-900 rounded-xl shadow border border-neutral-200 dark:border-neutral-800 mx-auto p-3 grid grid-cols-[1fr,60px] gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile?.profile_photo_url ? `${API_BASE}${profile.profile_photo_url}` : '/placeholder-avatar.png'} alt="profile" className="w-full h-full object-cover rounded" />
          <div className="flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold">ZENTORA</div>
              <div className="text-[10px] mt-1">TOURIST ID</div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile?.qr_url ? `${API_BASE}${profile.qr_url}` : '/placeholder-qr.png'} alt="qr" className="w-[56px] h-[56px]" />
          </div>
        </div>
        <div className="text-center mt-3">
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded border">Print</button>
        </div>
      </div>
    </div>
  )
}

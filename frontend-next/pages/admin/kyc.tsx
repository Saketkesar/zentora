import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '../../src/lib/api'

type KycItem = { id: number, front_path: string, back_path: string, status: string, created_at: string, user_id?: number }

export default function AdminKyc() {
  const [items, setItems] = useState<KycItem[]>([])
  const load = async () => {
    const r = await api('/api/admin/kyc/pending')
    if (r.ok) setItems((await r.json()).items)
  }
  useEffect(() => { load() }, [])
  const decide = async (id: number, action: 'approve'|'reject') => {
    const r = await api(`/api/admin/kyc/${id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    if (r.ok) {
      await r.json().catch(()=>undefined)
      if (action === 'approve') {
        alert('Approved. You can now create the Tourist ID.')
      }
      load()
    } else { alert('failed') }
  }
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white px-4 py-4">
      <Head><title>Admin KYC - Zentora</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">KYC Requests</h1>
        <Link className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 text-sm" href="/admin/dashboard">Back</Link>
      </header>
      <ul className="space-y-3">
        {items.map(it => (
          <li key={it.id} className="p-3 border rounded-xl border-neutral-200 dark:border-neutral-800">
            <div className="text-sm">#{it.id} • {new Date(it.created_at).toLocaleString()}</div>
            <div className="text-xs text-neutral-500">{it.status}</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <a href={`/api/proxy${it.front_path?.replace('data/', '/static/')}`} target="_blank" rel="noreferrer" className="block">
                <img src={`/api/proxy${it.front_path?.replace('data/', '/static/')}`} alt="front" className="w-full max-w-xs h-auto rounded border" />
              </a>
              <a href={`/api/proxy${it.back_path?.replace('data/', '/static/')}`} target="_blank" rel="noreferrer" className="block">
                <img src={`/api/proxy${it.back_path?.replace('data/', '/static/')}`} alt="back" className="w-full max-w-xs h-auto rounded border" />
              </a>
            </div>
            <div className="mt-2 flex gap-2 text-sm">
              <button onClick={()=>decide(it.id, 'approve')} className="px-3 py-1 rounded bg-green-600 text-white">Approve</button>
              <button onClick={()=>decide(it.id, 'reject')} className="px-3 py-1 rounded bg-red-600 text-white">Reject</button>
              {it.user_id && (
                <Link href={`/admin/ids?user_id=${it.user_id}`} className="px-3 py-1 rounded border">Create ID</Link>
              )}
            </div>
            {/* Tourist ID creation moved to /admin/ids */}
          </li>
        ))}
        {items.length===0 && <li className="text-neutral-500">No pending</li>}
      </ul>
    </div>
  )
}

// Tourist ID creation moved to a dedicated page

// Preview moved to dedicated ID page

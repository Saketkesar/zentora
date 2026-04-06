import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '../../src/lib/api'
import { Avatar } from '../../src/components/Avatar'
import { Users as UsersIcon, Shield, CreditCard, Trash2, Loader2, ArrowLeft, Radio } from 'lucide-react'

export default function AdminUsers() {
  // Minimal client-side guard
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
    if (!token || role !== 'admin') {
      window.location.replace('/admin/login')
    }
  }, [])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 50
  const load = async (p = 0) => {
    setLoading(true)
    try {
      const r = await api(`/api/admin/users/summary?limit=${pageSize}&offset=${p*pageSize}`)
      if (r.ok) {
        const data = await r.json()
        setItems(data.items || [])
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { load(page) }, [page])
  return (
    <div className="min-h-screen bg-white text-black px-3 sm:px-4 py-6">
      <Head><title>Users - Admin</title></Head>
      <header className="flex items-center justify-between mb-3">
  <h1 className="text-xl font-semibold flex items-center gap-2"><UsersIcon className="text-neutral-700" size={20} /> Tourist Users</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/dashboard" className="underline text-sm inline-flex items-center gap-1"><Shield className="text-neutral-700" size={16} /> Dashboard</Link>
          <Link href="/admin/ids" className="underline text-sm inline-flex items-center gap-1"><CreditCard className="text-neutral-700" size={16} /> IDs</Link>
        </div>
      </header>
      {loading ? (
        <div className="text-sm text-neutral-500 flex items-center gap-2"><Loader2 className="animate-spin text-neutral-500" size={16} /> Loading…</div>
      ) : (
        <div className="grid gap-2">
          {items.map(u => (
                <div key={u.id} className="grid md:grid-cols-3 gap-3 p-3 border rounded-xl border-neutral-200">
              <div className="flex items-center gap-3">
                <Avatar src={u.profile_photo_url ? `/api/proxy${u.profile_photo_url}` : undefined} alt={u.name} size={40} className="w-10 h-10" />
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-neutral-500">{u.email}</div>
                </div>
              </div>
                <div className="text-sm">
                  <div>ID Verification: <span className={`px-2 py-0.5 rounded text-xs ${u.aadhaar_verified?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{u.aadhaar_verified?'verified':'not verified'}</span></div>
                </div>
              <div className="text-sm flex items-center justify-between gap-3">
                {u.latest_tourist_id ? (
                  <div className="flex-1">
                    <div className="font-mono text-xs">{String(u.latest_tourist_id.uuid).slice(0,8)}…</div>
                    <div className="text-xs text-neutral-500">{u.latest_tourist_id.valid_from?.replace('T',' ').replace('Z','')} → {u.latest_tourist_id.valid_to?.replace('T',' ').replace('Z','')}</div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500">No ID yet</div>
                )}
                {u.latest_tourist_id && (
                  <button
                    onClick={async ()=>{
                      if (!confirm('Delete latest Tourist ID for this user?')) return
                      const r = await api(`/api/admin/users/${u.id}/tourist-id`, { method: 'DELETE' })
                      if (r.ok) { load(page) }
                    }}
                    className="px-2 py-1 rounded border border-red-300 text-red-600 inline-flex items-center gap-1"
                  >
                    <Trash2 className="text-red-600" size={16} /> Delete
                  </button>
                )}
                {/* Unbind RFID button if a binding exists */}
                {u.rfid_tag_id ? (
                  <button
                    onClick={async ()=>{
                      if (!confirm('Delete RFID binding for this user?')) return
                      const r = await api(`/api/admin/users/${u.id}/rfid-binding`, { method: 'DELETE' })
                      if (r.ok) { load(page) }
                    }}
                    className="px-2 py-1 rounded border border-red-300 text-red-600 inline-flex items-center gap-1"
                  >
                    <Trash2 className="text-red-600" size={16} /> RFID
                  </button>
                ) : null}
                <Link href={`/admin/rfid?user_id=${u.id}${u.rfid_blockchain_id ? `&blockchain_id=${encodeURIComponent(u.rfid_blockchain_id)}`: (u.latest_tourist_id?.uuid ? `&blockchain_id=${encodeURIComponent(u.latest_tourist_id.uuid)}` : '')}${u.rfid_tag_id ? `&tag_id=${encodeURIComponent(u.rfid_tag_id)}`: ''}`} className="px-2 py-1 rounded border border-neutral-300 inline-flex items-center gap-1"><Radio size={16}/> RFID</Link>
                {/* Delete user (with cleanup) */}
                <button
                  onClick={async ()=>{
                    if (!confirm(`Delete user "${u.name}" and all linked data? This cannot be undone.`)) return
                    const r = await api(`/api/admin/users/${u.id}`, { method: 'DELETE' })
                    if (r.ok) { load(page) }
                  }}
                  className="px-2 py-1 rounded border border-red-300 text-red-600 inline-flex items-center gap-1"
                >
                  <Trash2 className="text-red-600" size={16} /> User
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 justify-end pt-2">
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} className="px-2 py-1 rounded border">Prev</button>
            <button onClick={()=>setPage(p=>p+1)} className="px-2 py-1 rounded border">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}

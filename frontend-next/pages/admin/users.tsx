import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '../../src/lib/api'
import { Avatar } from '../../src/components/Avatar'
import { Users as UsersIcon, Shield, CreditCard, Trash2, Loader2, ArrowLeft, Radio, Zap } from 'lucide-react'
import { playSuccessBeep, playErrorBeep } from '../../src/lib/audioUtils'

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
      const r = await api(`/admin/users/summary?limit=${pageSize}&offset=${p*pageSize}`)
      if (r.ok) {
        const data = await r.json()
        setItems(data.items || [])
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { load(page) }, [page])
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-black px-3 sm:px-4 py-6">
      <Head><title>Users - Admin</title></Head>
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <UsersIcon className="text-blue-600" size={28} /> 
          Tourist Users
        </h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/dashboard" className="px-3 py-2 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50 transition-colors inline-flex items-center gap-2 text-sm font-medium">
            <Shield size={16} /> Dashboard
          </Link>
        </div>
      </header>
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="inline-block animate-spin text-blue-600 mb-2" size={32} />
          <p className="text-neutral-600">Loading users...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.length === 0 && (
            <div className="p-8 rounded-2xl bg-white border-2 border-neutral-200 text-center">
              <UsersIcon className="inline-block mb-3 text-neutral-300" size={40} />
              <p className="text-neutral-600 text-lg">No users found</p>
            </div>
          )}
          {items.map(u => (
            <div key={u.id} className="p-5 rounded-xl bg-white border-2 border-neutral-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar src={u.profile_photo_url ? `/api/proxy${u.profile_photo_url}` : undefined} alt={u.name} size={48} className="w-12 h-12 rounded-lg" />
                  <div>
                    <div className="font-bold text-lg">{u.name}</div>
                    <div className="text-sm text-neutral-600">{u.email}</div>
                    <div className="text-sm text-neutral-600">📞 {u.phone || 'N/A'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold ${
                    u.aadhaar_verified 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                      : 'bg-neutral-100 text-neutral-700 border border-neutral-300'
                  }`}>
                    {u.aadhaar_verified ? 'AADHAAR Verified' : 'No AADHAAR'}
                  </span>
                </div>
              </div>

              {/* Status info grid */}
              <div className="grid md:grid-cols-3 gap-3 mb-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                {/* Latest ID */}
                <div>
                  <div className="text-xs font-semibold text-neutral-600 mb-2">Tourist ID</div>
                  {u.latest_tourist_id ? (
                    <div>
                      <div className="font-mono text-xs font-semibold text-blue-600">{String(u.latest_tourist_id.uuid).slice(0,12)}…</div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Valid: {u.latest_tourist_id.valid_from?.replace('T',' ').split(' ')[0]} → {u.latest_tourist_id.valid_to?.replace('T',' ').split(' ')[0]}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500">—</div>
                  )}
                </div>

                {/* RFID binding */}
                <div>
                  <div className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-1">
                    <Zap size={14} /> RFID Tag
                  </div>
                  {u.rfid_tag_id ? (
                    <div className="font-mono text-xs text-purple-600 font-semibold">{u.rfid_tag_id}</div>
                  ) : (
                    <div className="text-xs text-neutral-500">Not bound</div>
                  )}
                </div>

                {/* User ID */}
                <div>
                  <div className="text-xs font-semibold text-neutral-600 mb-2">User ID</div>
                  <div className="font-mono text-xs text-neutral-600">#{u.id}</div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {u.latest_tourist_id ? (
                  <button
                    onClick={async ()=>{
                      if (!confirm('Delete latest Tourist ID for this user?')) return
                      const r = await api(`/api/admin/users/${u.id}/tourist-id`, { method: 'DELETE' })
                      if (r.ok) {
                        playSuccessBeep()
                        load(page)
                      } else {
                        playErrorBeep()
                      }
                    }}
                    className="px-3 py-2 rounded-lg border-2 border-rose-300 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition-colors inline-flex items-center gap-1"
                  >
                    <Trash2 size={16} /> Delete ID
                  </button>
                ) : null}

                {u.rfid_tag_id ? (
                  <button
                    onClick={async ()=>{
                      if (!confirm('Delete RFID binding for this user?')) return
                      const r = await api(`/api/admin/users/${u.id}/rfid-binding`, { method: 'DELETE' })
                      if (r.ok) {
                        playSuccessBeep()
                        load(page)
                      } else {
                        playErrorBeep()
                      }
                    }}
                    className="px-3 py-2 rounded-lg border-2 border-purple-300 text-purple-600 text-sm font-semibold hover:bg-purple-50 transition-colors inline-flex items-center gap-1"
                  >
                    <Zap size={16} /> Unbind RFID
                  </button>
                ) : null}

                <Link 
                  href={`/admin/rfid?user_id=${u.id}${u.rfid_blockchain_id ? `&blockchain_id=${encodeURIComponent(u.rfid_blockchain_id)}`: (u.latest_tourist_id?.uuid ? `&blockchain_id=${encodeURIComponent(u.latest_tourist_id.uuid)}` : '')}${u.rfid_tag_id ? `&tag_id=${encodeURIComponent(u.rfid_tag_id)}`: ''}`} 
                  className="px-3 py-2 rounded-lg border-2 border-neutral-300 text-neutral-600 text-sm font-semibold hover:bg-neutral-50 transition-colors inline-flex items-center gap-1"
                >
                  <Radio size={16}/> RFID
                </Link>

                <button
                  onClick={async ()=>{
                    if (!confirm(`Delete user "${u.name}" and all linked data? This cannot be undone.`)) return
                    const r = await api(`/api/admin/users/${u.id}`, { method: 'DELETE' })
                    if (r.ok) {
                      playSuccessBeep()
                      load(page)
                    } else {
                      playErrorBeep()
                    }
                  }}
                  className="px-3 py-2 rounded-lg border-2 border-rose-300 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition-colors inline-flex items-center gap-1 ml-auto"
                >
                  <Trash2 size={16} /> Delete User
                </button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center gap-2 justify-end pt-4">
            <button 
              onClick={()=>setPage(p=>Math.max(0,p-1))} 
              disabled={page === 0}
              className="px-4 py-2 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-neutral-600 px-2">Page {page + 1}</span>
            <button 
              onClick={()=>setPage(p=>p+1)} 
              className="px-4 py-2 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50 font-medium transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

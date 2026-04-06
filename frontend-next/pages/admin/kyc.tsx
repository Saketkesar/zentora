import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '../../src/lib/api'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, FileText } from 'lucide-react'
import { playSuccessBeep, playErrorBeep } from '../../src/lib/audioUtils'

type KycItem = { id: number, front_path: string, back_path: string, status: string, created_at: string, user_id?: number }

export default function AdminKyc() {
  const [items, setItems] = useState<KycItem[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api('/admin/kyc/pending')
      if (r.ok) setItems((await r.json()).items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const decide = async (id: number, action: 'approve'|'reject') => {
    setProcessingId(id)
    try {
      const r = await api(`/api/admin/kyc/${id}/decision`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ action }) 
      })
      if (r.ok) {
        await r.json().catch(()=>undefined)
        if (action === 'approve') {
          playSuccessBeep()
          setToast('KYC approved. User can now create Tourist ID.')
        } else {
          playErrorBeep()
          setToast('KYC rejected.')
        }
        setTimeout(() => setToast(null), 3000)
        load()
      } else {
        playErrorBeep()
        alert('Action failed')
      }
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-black px-4 py-6">
      <Head><title>Admin KYC - Zentora</title></Head>
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50 transition-colors">
              <ArrowLeft size={18} /> Back
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="text-blue-600" size={28} />
              KYC Verification
            </h1>
          </div>
          <button 
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-black text-white font-medium hover:bg-neutral-900 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </header>

        {/* Toast notification */}
        {toast && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-50 border-2 border-emerald-300 text-emerald-700 font-medium flex items-center gap-2">
            <CheckCircle2 size={20} /> {toast}
          </div>
        )}

        {/* Pending items list */}
        <div className="space-y-4">
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="inline-block animate-spin text-blue-600 mb-2" size={32} />
              <p className="text-neutral-600">Loading KYC requests...</p>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="p-8 rounded-2xl bg-white border-2 border-neutral-200 text-center">
              <FileText className="inline-block mb-3 text-neutral-300" size={40} />
              <p className="text-neutral-600 text-lg">No pending KYC requests</p>
              <p className="text-sm text-neutral-500 mt-1">All KYC submissions have been reviewed</p>
            </div>
          )}

          {!loading && items.map(it => (
            <div key={it.id} className="p-6 rounded-2xl bg-white border-2 border-neutral-200 shadow-lg hover:shadow-xl transition-shadow">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-neutral-600">KYC Request #{it.id}</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Submitted: {new Date(it.created_at).toLocaleString()}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                  it.status === 'pending' ? 'bg-amber-50 text-amber-700 border-2 border-amber-200' :
                  it.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200' :
                  'bg-rose-50 text-rose-700 border-2 border-rose-200'
                }`}>
                  {it.status === 'pending' && '⏳ Pending'}
                  {it.status === 'approved' && 'Approved'}
                  {it.status === 'rejected' && '✗ Rejected'}
                </div>
              </div>

              {/* ID Images */}
              <div className="mt-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                <p className="text-sm font-semibold mb-3 text-neutral-700">Personal ID Scans</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Front */}
                  <div>
                    <div className="text-xs font-medium text-neutral-600 mb-2">Front Side</div>
                    <a 
                      href={`/api/proxy${it.front_path?.replace('data/', '/static/')}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="block group"
                    >
                      <img 
                        src={`/api/proxy${it.front_path?.replace('data/', '/static/')}`} 
                        alt="front" 
                        className="w-full h-auto rounded-lg border-2 border-neutral-300 group-hover:border-blue-400 transition-colors"
                      />
                    </a>
                  </div>

                  {/* Back */}
                  <div>
                    <div className="text-xs font-medium text-neutral-600 mb-2">Back Side</div>
                    <a 
                      href={`/api/proxy${it.back_path?.replace('data/', '/static/')}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="block group"
                    >
                      <img 
                        src={`/api/proxy${it.back_path?.replace('data/', '/static/')}`} 
                        alt="back" 
                        className="w-full h-auto rounded-lg border-2 border-neutral-300 group-hover:border-blue-400 transition-colors"
                      />
                    </a>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {it.status === 'pending' && (
                <div className="mt-6 flex items-center gap-3 flex-wrap">
                  <button 
                    onClick={() => decide(it.id, 'approve')}
                    disabled={processingId === it.id}
                    className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                  >
                    {processingId === it.id ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        Approve KYC
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => decide(it.id, 'reject')}
                    disabled={processingId === it.id}
                    className="flex-1 px-4 py-3 rounded-lg bg-rose-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                  >
                    {processingId === it.id ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Processing...
                      </>
                    ) : (
                      <>
                        <XCircle size={18} />
                        Reject KYC
                      </>
                    )}
                  </button>

                  {it.user_id && (
                    <Link 
                      href={`/admin/ids?user_id=${it.user_id}`}
                      className="flex-1 px-4 py-3 rounded-lg border-2 border-blue-300 text-blue-600 font-semibold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
                    >
                      <CheckCircle2 size={18} />
                      Create Tourist ID
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

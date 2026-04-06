import Head from 'next/head'
import { useState } from 'react'
import { api } from '../src/lib/api'

export default function VerifyPage() {
  const [input, setInput] = useState('')
  const [by, setBy] = useState<'tag'|'tourist'|'chain'>('tag')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const payload: any = {}
      if (by === 'tag') payload.tag_id = input.trim().toUpperCase()
      if (by === 'tourist') payload.tourist_uuid = input.trim()
      if (by === 'chain') payload.blockchain_id = input.trim()
      const r = await api('/rfid/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!r.ok) {
        const msg = await r.text()
        setError(msg || 'Verification failed')
      } else {
        const data = await r.json()
        setResult(data)
      }
    } catch (e: any) {
      setError(e?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black px-3 sm:px-4 py-6">
      <Head><title>Verify Tourist ID</title></Head>
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-semibold mb-2">Verify Tourist</h1>
        <p className="text-sm text-neutral-600 mb-4">Enter an RFID Tag ID, a Tourist UUID (e.g., 0x777....), or a Blockchain/Tx ID written on the tag.</p>
        <form onSubmit={submit} className="p-4 border rounded-2xl border-neutral-200 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <label className="inline-flex items-center gap-1 text-sm"><input type="radio" name="by" checked={by==='tag'} onChange={()=>setBy('tag')} /> Tag ID</label>
            <label className="inline-flex items-center gap-1 text-sm"><input type="radio" name="by" checked={by==='tourist'} onChange={()=>setBy('tourist')} /> Tourist UUID</label>
            <label className="inline-flex items-center gap-1 text-sm"><input type="radio" name="by" checked={by==='chain'} onChange={()=>setBy('chain')} /> Blockchain ID</label>
          </div>
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder={by==='tag'? 'A1B2C3D4' : by==='tourist' ? '0x777...' : '0x...'} className="w-full px-3 py-2 rounded border border-neutral-300 font-mono" />
          <div className="mt-3">
            <button disabled={loading || !input.trim()} className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50">{loading? 'Verifying…' : 'Verify'}</button>
          </div>
        </form>
        {error && <div className="mt-3 p-3 rounded border border-rose-300 bg-rose-50 text-rose-700 text-sm">{error}</div>}
        {result && (
          <div className="mt-4 p-4 border rounded-2xl border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="text-sm">User</div>
              <div className={`px-2 py-0.5 rounded text-xs ${result.valid? 'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{result.valid? 'VALID':'INVALID'}</div>
            </div>
            <div className="text-base font-medium mt-1">{result.name_masked || 'Unknown'}</div>
            {result.tourist_id && <div className="text-xs text-neutral-600 font-mono">{String(result.tourist_id)}</div>}
            {result.valid_from && result.valid_to && (
              <div className="text-xs text-neutral-600 mt-1">{String(result.valid_from).replace('T',' ').replace('Z','')} → {String(result.valid_to).replace('T',' ').replace('Z','')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

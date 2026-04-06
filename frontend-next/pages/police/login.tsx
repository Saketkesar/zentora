import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { api } from '../../src/lib/api'

export default function PoliceLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token'); localStorage.removeItem('refresh_token'); localStorage.removeItem('role')
      }
      const res = await api('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (res.ok) {
        const data = await res.json()
        if (typeof window !== 'undefined' && data?.access_token) {
          localStorage.setItem('token', data.access_token)
          if (data?.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
          try {
            const payload = JSON.parse(atob(data.access_token.split('.')[1]))
            if (payload?.role) localStorage.setItem('role', payload.role)
            const role = payload?.role || data?.role
            if (role !== 'police') { alert('This account is not police'); return }
          } catch {}
        }
        router.replace('/police/dashboard')
      } else {
        const txt = await res.text().catch(()=>null)
        alert(`Login failed${txt?`: ${txt}`:''}`)
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="min-h-screen px-4 py-8 text-[#17151b] md:px-6" style={{ fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif' }}>
      <Head><title>Police Login | Zentora</title></Head>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_9%,#e8fff4_0,#ecf6ff_45%,#f5f6f9_100%)]" />

      <div className="mx-auto max-w-lg rounded-3xl border border-[#17151b24] bg-white/92 p-6 shadow-[0_20px_60px_-35px_rgba(23,21,27,0.6)] md:p-8">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#17151b29] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#586173]">
          Emergency Response Access
        </p>
        <h1 className="mt-4 text-2xl font-semibold">Police Login</h1>
        <p className="mt-2 text-sm text-[#465064]">Monitor active SOS alerts, open incidents, and field events in the operational dashboard.</p>

        <form onSubmit={submit} className="mt-5 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[#465064]">Email</span>
            <input value={email} onChange={e=>setEmail(e.target.value)} required type="email" className="rounded-xl border border-[#17151b2e] bg-white px-3 py-2.5 outline-none focus:border-[#0f766e]" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[#465064]">Password</span>
            <input value={password} onChange={e=>setPassword(e.target.value)} required type="password" className="rounded-xl border border-[#17151b2e] bg-white px-3 py-2.5 outline-none focus:border-[#0f766e]" />
          </label>
          <button disabled={loading} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f5c57] px-4 py-2.5 font-semibold text-white hover:bg-[#126f69] disabled:opacity-60">
            <ShieldAlert size={16} /> {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <Link className="mt-4 inline-flex items-center gap-1 text-sm font-semibold underline" href="/">
          <ArrowLeft size={14} /> Back
        </Link>
      </div>
    </div>
  )
}

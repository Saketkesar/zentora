import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, ShieldCheck, UserRound } from 'lucide-react'
import { useI18n } from '../src/i18n/useI18n'
import { api } from '../src/lib/api'

export default function Login() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const quickFill = (who: 'admin'|'police'|'tourist') => {
    if (who === 'admin') { setEmail('admin@zentora.local'); setPassword('Admin@12345') }
    else if (who === 'police') { setEmail('police@zentora.local'); setPassword('Police@12345') }
    else { setEmail(''); setPassword('') }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // clear stale tokens to avoid mixing roles
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token'); localStorage.removeItem('refresh_token'); localStorage.removeItem('role')
      }
      const res = await api('/api/auth/login', {
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
            // redirect based on role
            const role = payload?.role || data?.role
            if (role === 'admin') return router.replace('/admin/dashboard')
            if (role === 'police') return router.replace('/police/dashboard')
          } catch {}
        }
        router.replace('/tourist/dashboard')
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
      <Head><title>{`${t('login.title')} | Zentora`}</title></Head>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,#e7f3ff_0,#fff5e5_35%,#f7f8fb_75%)]" />
      <div className="fixed inset-0 -z-10 opacity-35 [background-image:linear-gradient(to_right,rgba(23,21,27,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(23,21,27,0.08)_1px,transparent_1px)] [background-size:26px_26px]" />

      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_1.1fr]">
        <section className="rounded-3xl border border-[#17151b24] bg-white/80 p-5 md:p-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#17151b1f] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#586173]">
            Tourist + Ops Access
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight">Sign in to your Zentora workspace</h1>
          <p className="mt-3 text-sm text-[#465064]">Use one login entry point and route automatically to Tourist, Admin, or Police dashboards.</p>

          <div className="mt-5 grid gap-3 text-sm">
            <div className="rounded-2xl border border-[#17151b1f] bg-[#f8f5ec] p-3">Role-aware JWT routing after successful login</div>
            <div className="rounded-2xl border border-[#17151b1f] bg-[#f8f5ec] p-3">Quick credentials helper for local testing</div>
            <div className="rounded-2xl border border-[#17151b1f] bg-[#f8f5ec] p-3">Real-time safety feeds remain role-scoped</div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#17151b24] bg-white/90 p-5 shadow-[0_20px_60px_-35px_rgba(23,21,27,0.6)] md:p-7">
          <h2 className="text-xl font-semibold">{t('login.title')}</h2>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-[#465064]">{t('common.email')}</span>
              <input value={email} onChange={e=>setEmail(e.target.value)} required type="email" placeholder="you@example.com" className="rounded-xl border border-[#17151b2e] bg-white px-3 py-2.5 outline-none focus:border-[#1d4ed8]" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-[#465064]">{t('common.password')}</span>
              <input value={password} onChange={e=>setPassword(e.target.value)} required type="password" placeholder="Enter password" className="rounded-xl border border-[#17151b2e] bg-white px-3 py-2.5 outline-none focus:border-[#1d4ed8]" />
            </label>

            <button disabled={loading} className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#17151b] px-4 py-2.5 font-semibold text-white hover:bg-[#2a2731] disabled:opacity-60">
              <ShieldCheck size={16} /> {loading ? 'Signing in...' : t('login.submit')}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={()=>quickFill('admin')} className="rounded-full border border-[#17151b33] px-3 py-1.5 hover:bg-[#17151b0d]">Fill Admin</button>
            <button type="button" onClick={()=>quickFill('police')} className="rounded-full border border-[#17151b33] px-3 py-1.5 hover:bg-[#17151b0d]">Fill Police</button>
            <button type="button" onClick={()=>quickFill('tourist')} className="rounded-full border border-[#17151b33] px-3 py-1.5 hover:bg-[#17151b0d]">Clear</button>
          </div>

          <div className="mt-4 rounded-2xl border border-[#17151b1f] bg-[#f5f8ff] p-3 text-sm text-[#2e3f66]">
            <p className="inline-flex items-center gap-2 font-medium"><UserRound size={15} /> Need a new account?</p>
            <Link className="mt-2 inline-flex items-center gap-1 font-semibold underline" href="/register">
              {t('login.register')} <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

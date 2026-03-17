import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, ClipboardCheck, UserPlus } from 'lucide-react'
import { useI18n } from '../src/i18n/useI18n'
import { api } from '../src/lib/api'

export default function Register() {
  const { t } = useI18n()
  const [form, setForm] = useState({ name: '', email: '', password: '', dob: '', profession: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          dob: form.dob,
          profession: form.profession,
          phone: form.phone,
        })
      })
      if (res.ok) {
        router.push('/login')
      } else {
        alert('Registration failed')
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen px-4 py-8 text-[#17151b] md:px-6" style={{ fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif' }}>
      <Head><title>{`${t('register.title')} | Zentora`}</title></Head>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,#e9f5ff_0,#fff2e6_32%,#f5f6f9_75%)]" />
      <div className="fixed inset-0 -z-10 opacity-30 [background-image:linear-gradient(to_right,rgba(23,21,27,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(23,21,27,0.08)_1px,transparent_1px)] [background-size:26px_26px]" />

      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-[#17151b21] bg-white/85 p-5 md:p-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#17151b1f] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#586173]">
            New Tourist Onboarding
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight">Create profile and start verification</h1>
          <p className="mt-3 text-sm text-[#465064]">This form creates your account. KYC approval and Tourist ID issuance are handled by admin workflows afterward.</p>

          <div className="mt-5 grid gap-3 text-sm">
            <div className="rounded-2xl border border-[#17151b1f] bg-[#f8f5ec] p-3">Step 1: account + identity details</div>
            <div className="rounded-2xl border border-[#17151b1f] bg-[#f8f5ec] p-3">Step 2: login and submit KYC artifacts</div>
            <div className="rounded-2xl border border-[#17151b1f] bg-[#f8f5ec] p-3">Step 3: receive verification status</div>
          </div>

          <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline">
            <ArrowLeft size={14} /> Back to login
          </Link>
        </section>

        <section className="rounded-3xl border border-[#17151b24] bg-white/92 p-5 shadow-[0_20px_60px_-35px_rgba(23,21,27,0.6)] md:p-7">
          <h2 className="text-xl font-semibold">{t('register.title')}</h2>
          <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
            {['name','email','password','dob','profession','phone'].map((k) => (
              <label key={k} className={`grid gap-1.5 ${k === 'password' ? 'md:col-span-2' : ''}`}>
                <span className="text-sm font-medium text-[#465064]">{t(`register.${k}` as any)}</span>
                <input
                  value={(form as any)[k]}
                  onChange={e=>setForm(prev=>({ ...prev, [k]: e.target.value }))}
                  required={['name','email','password','dob','phone'].includes(k)}
                  type={k==='password'?'password':(k==='dob'?'date':(k==='email'?'email':'text'))}
                  placeholder={k === 'profession' ? 'Optional' : undefined}
                  className="rounded-xl border border-[#17151b2e] bg-white px-3 py-2.5 outline-none focus:border-[#1d4ed8]"
                />
              </label>
            ))}
            <button disabled={loading} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#17151b] px-4 py-2.5 font-semibold text-white hover:bg-[#2a2731] disabled:opacity-60 md:col-span-2">
              <UserPlus size={16} /> {loading ? 'Creating account...' : t('register.submit')}
            </button>
          </form>

          <div className="mt-4 rounded-2xl border border-[#17151b1f] bg-[#f4f8ff] p-3 text-sm text-[#2e3f66]">
            <p className="inline-flex items-center gap-2 font-medium"><ClipboardCheck size={15} /> After registration</p>
            <p className="mt-1">Log in and continue with Aadhaar verification to unlock Tourist ID workflows.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

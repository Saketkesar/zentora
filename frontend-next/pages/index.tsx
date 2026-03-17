import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BellRing, Building2, LogIn, MapPinned, Shield, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useI18n } from '../src/i18n/useI18n'
import { LanguageSwitcher } from '../src/components/LanguageSwitcher'

export default function Home() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen text-[#161418]" style={{ fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif' }}>
      <Head>
        <title>Zentora | Tourist Safety Grid</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap" rel="stylesheet" />
      </Head>

      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,#e7f3ff_0,#fff3e2_35%,#f8f6ef_60%,#f4f5f7_100%)]" />
      <div className="fixed inset-0 -z-10 opacity-40 [background-image:linear-gradient(to_right,rgba(22,20,24,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(22,20,24,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />

      <header className="sticky top-0 z-30 border-b border-[#1614181a] bg-[#f8f6efcc] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <Image src="https://port88drops.netlify.app/PORT_88.svg" alt="Zentora" width={36} height={36} />
            <span className="text-lg font-semibold tracking-tight">Zentora</span>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher />
            <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-[#1614183a] px-3 py-1.5 text-sm font-medium hover:bg-[#1614180d]">
              <LogIn size={15} /> {t('landing.login')}
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 pb-14 pt-8 md:px-6 md:pt-10">
        <section className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1.15fr_0.85fr] md:gap-8">
          <div className="rounded-3xl border border-[#16141824] bg-white/85 p-6 shadow-[0_18px_60px_-35px_rgba(22,20,24,0.55)] md:p-8 animate-fade-in">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#16141829] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#3e495b]">
              Port 88 initiative
            </div>
            <h1 className="mb-4 text-4xl leading-tight md:text-5xl" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              Smart Tourist Safety,
              <span className="block text-[#c1531b]">Mapped and Actionable</span>
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-[#3e495b]">
              {t('landing.heroSubtitle')} Zentora combines tourist onboarding, KYC verification, geofencing,
              SOS alerts, and police/admin response in one coordinated system built for local-network reliability.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-[#161418] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a2830]">
                <UserPlus size={16} /> {t('landing.register')}
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-[#16141836] bg-white px-5 py-2.5 text-sm font-semibold hover:bg-[#16141808]">
                <LogIn size={16} /> {t('landing.login')}
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[#1614181f] bg-[#f8f6ef] p-3">
                <p className="text-xs uppercase tracking-wide text-[#657086]">Frontend</p>
                <p className="mt-1 text-sm font-semibold">Next.js PWA</p>
              </div>
              <div className="rounded-2xl border border-[#1614181f] bg-[#f8f6ef] p-3">
                <p className="text-xs uppercase tracking-wide text-[#657086]">Backend</p>
                <p className="mt-1 text-sm font-semibold">FastAPI + JWT</p>
              </div>
              <div className="rounded-2xl border border-[#1614181f] bg-[#f8f6ef] p-3">
                <p className="text-xs uppercase tracking-wide text-[#657086]">Data</p>
                <p className="mt-1 text-sm font-semibold">KYC + Itineraries</p>
              </div>
              <div className="rounded-2xl border border-[#1614181f] bg-[#f8f6ef] p-3">
                <p className="text-xs uppercase tracking-wide text-[#657086]">Ops</p>
                <p className="mt-1 text-sm font-semibold">Admin + Police</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#16141824] bg-[#161418] p-5 text-[#f6f2e8] shadow-[0_20px_70px_-35px_rgba(0,0,0,0.8)] animate-rise md:p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-[#a9b3c9]">Live capability map</p>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <MapPinned size={18} className="text-[#73c0ff]" />
                <div>
                  <p className="text-sm font-semibold">Live map + movement stream</p>
                  <p className="text-xs text-[#c3cedf]">Track tourist markers, route drift, and location freshness.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <Shield size={18} className="text-[#97de9e]" />
                <div>
                  <p className="text-sm font-semibold">Geofence and itinerary compliance</p>
                  <p className="text-xs text-[#c3cedf]">Detect unauthorized deviations and raise structured incidents.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <BellRing size={18} className="text-[#ffc376]" />
                <div>
                  <p className="text-sm font-semibold">SOS response channel</p>
                  <p className="text-xs text-[#c3cedf]">Broadcast alerts to dashboards with acknowledgement workflow.</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <Link href="/admin/login" className="rounded-full border border-white/20 px-3 py-1.5 hover:bg-white/10">{t('landing.adminLogin')}</Link>
              <Link href="/police/login" className="rounded-full border border-white/20 px-3 py-1.5 hover:bg-white/10">{t('landing.policeLogin')}</Link>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-6xl">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Project Detail Snapshot</h2>
            <span className="text-xs uppercase tracking-[0.14em] text-[#657086]">production intent + local dev</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#16141821] bg-white/85 p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold"><Users size={16} /> Tourist Layer</p>
              <ul className="space-y-2 text-sm text-[#3e495b]">
                <li>Registration, profile, KYC request</li>
                <li>Tourist ID + QR flow</li>
                <li>SOS trigger and complaint filing</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-[#16141821] bg-white/85 p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold"><Building2 size={16} /> Operations Layer</p>
              <ul className="space-y-2 text-sm text-[#3e495b]">
                <li>Admin dashboard for KYC, IDs, geofences</li>
                <li>Police dashboard for SOS + incidents</li>
                <li>Role-aware JWT auth and audit-friendly actions</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-[#16141821] bg-white/85 p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} /> Safety Engine</p>
              <ul className="space-y-2 text-sm text-[#3e495b]">
                <li>Geofence checks and itinerary drift signals</li>
                <li>WebSocket pushes for active alerting</li>
                <li>Extensible RFID + blockchain hooks</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#1614181f] bg-[#fffaf0] p-4 text-sm text-[#3e495b]">
            <p className="font-semibold text-[#161418]">What this project is optimized for</p>
            <p className="mt-1">Mobile-first field usage, low-friction operator response, and clear accountability from onboarding to incident closure.</p>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-6xl rounded-3xl border border-[#16141824] bg-white/88 p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">System Diagram</h2>
            <span className="text-xs uppercase tracking-[0.14em] text-[#657086]">request + event flow</span>
          </div>

          <div className="overflow-x-auto">
            <svg viewBox="0 0 980 340" className="min-w-[760px] w-full">
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#394050" />
                </marker>
              </defs>

              <rect x="20" y="36" width="170" height="64" rx="14" fill="#e8f2ff" stroke="#365a8b" />
              <text x="105" y="63" textAnchor="middle" fontSize="14" fill="#14253b" fontWeight="600">Tourist App</text>
              <text x="105" y="82" textAnchor="middle" fontSize="12" fill="#335074">PWA / SOS / KYC</text>

              <rect x="20" y="130" width="170" height="64" rx="14" fill="#fff0db" stroke="#8b5d2f" />
              <text x="105" y="157" textAnchor="middle" fontSize="14" fill="#3f2a17" fontWeight="600">Admin Dashboard</text>
              <text x="105" y="176" textAnchor="middle" fontSize="12" fill="#6f4a28">KYC / IDs / Geofence</text>

              <rect x="20" y="224" width="170" height="64" rx="14" fill="#eaf9ef" stroke="#2e6f45" />
              <text x="105" y="251" textAnchor="middle" fontSize="14" fill="#183627" fontWeight="600">Police Console</text>
              <text x="105" y="270" textAnchor="middle" fontSize="12" fill="#2f5b44">SOS / Incident ops</text>

              <rect x="372" y="104" width="230" height="118" rx="16" fill="#161418" />
              <text x="487" y="140" textAnchor="middle" fontSize="16" fill="#f7f2e8" fontWeight="700">FastAPI Core</text>
              <text x="487" y="164" textAnchor="middle" fontSize="12" fill="#c6d0e0">JWT Auth + Role APIs</text>
              <text x="487" y="184" textAnchor="middle" fontSize="12" fill="#c6d0e0">WebSocket Alert Broadcast</text>

              <rect x="760" y="46" width="190" height="64" rx="14" fill="#f4f5f7" stroke="#4b5567" />
              <text x="855" y="73" textAnchor="middle" fontSize="14" fill="#202633" fontWeight="600">Database</text>
              <text x="855" y="92" textAnchor="middle" fontSize="12" fill="#4b5567">Users / Alerts / KYC</text>

              <rect x="760" y="136" width="190" height="64" rx="14" fill="#f4f5f7" stroke="#4b5567" />
              <text x="855" y="163" textAnchor="middle" fontSize="14" fill="#202633" fontWeight="600">Static + QR Storage</text>
              <text x="855" y="182" textAnchor="middle" fontSize="12" fill="#4b5567">Uploads / Tourist IDs</text>

              <rect x="760" y="226" width="190" height="64" rx="14" fill="#f4f5f7" stroke="#4b5567" />
              <text x="855" y="253" textAnchor="middle" fontSize="14" fill="#202633" fontWeight="600">Optional IoT/RFID</text>
              <text x="855" y="272" textAnchor="middle" fontSize="12" fill="#4b5567">Tag verify + events</text>

              <line x1="190" y1="68" x2="372" y2="128" stroke="#394050" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="190" y1="162" x2="372" y2="162" stroke="#394050" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="190" y1="256" x2="372" y2="198" stroke="#394050" strokeWidth="2" markerEnd="url(#arrow)" />

              <line x1="602" y1="138" x2="760" y2="78" stroke="#394050" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="602" y1="164" x2="760" y2="168" stroke="#394050" strokeWidth="2" markerEnd="url(#arrow)" />
              <line x1="602" y1="192" x2="760" y2="258" stroke="#394050" strokeWidth="2" markerEnd="url(#arrow)" />
            </svg>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-[#3e495b] md:grid-cols-3">
            <p className="rounded-xl bg-[#f6f8fc] p-3">1. Interfaces submit auth and operational actions through a single API gateway.</p>
            <p className="rounded-xl bg-[#f6f8fc] p-3">2. FastAPI coordinates persistence, role checks, and real-time alert fanout.</p>
            <p className="rounded-xl bg-[#f6f8fc] p-3">3. Police/admin clients consume updates to acknowledge and resolve incidents.</p>
          </div>
        </section>
      </main>

      <footer className="px-4 py-10 text-xs text-[#4d5564] md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span>{t('landing.footerNote')}</span>
          <span className="inline-flex items-center gap-1">Explore Modules <ArrowRight size={14} /></span>
        </div>
      </footer>
    </div>
  )
}

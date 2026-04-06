import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, Clock, AlertCircle } from 'lucide-react'

export default function PendingAadhaar() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-black px-4 py-6">
      <Head><title>Pending AADHAAR Verification - Zentora</title></Head>
      <header className="flex items-center justify-between mb-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50 transition-colors">
            <ArrowLeft size={18} /> Back
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="text-amber-600" size={28} />
            AADHAAR Verification
          </h1>
        </div>
      </header>
      <div className="max-w-4xl mx-auto p-8 rounded-2xl bg-white border-2 border-neutral-200 shadow-sm text-center">
        <AlertCircle className="inline-block mb-3 text-amber-500" size={40} />
        <p className="text-neutral-600 text-lg">AADHAAR verification table coming soon</p>
        <p className="text-neutral-500 text-sm mt-2">Pending AADHAAR verifications will be displayed here</p>
      </div>
    </div>
  )
}

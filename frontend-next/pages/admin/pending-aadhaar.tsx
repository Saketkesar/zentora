import Head from 'next/head'
import Link from 'next/link'

export default function PendingAadhaar() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white px-4 py-4">
      <Head><title>Pending Verification - Zentora</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Pending Verification</h1>
        <Link className="underline text-sm" href="/">Home</Link>
      </header>
      <div className="p-4 border rounded-xl border-neutral-200 dark:border-neutral-800">Table goes here</div>
    </div>
  )
}

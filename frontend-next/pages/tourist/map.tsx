import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { TouristBottomNav } from '../../src/components/TouristBottomNav'

const MapView = dynamic(() => import('../../src/components/MapView').then(m => m.MapView), { ssr: false })

export default function TouristMap() {
  return (
    <div className="min-h-screen bg-white text-black px-4 py-4 pb-32">
      <Head><title>Map - Zentora</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Live Map</h1>
        <Link className="underline text-sm" href="/tourist/dashboard">Back</Link>
      </header>
      <div className="h-[70vh]">
        <MapView />
      </div>
      <TouristBottomNav />
    </div>
  )
}

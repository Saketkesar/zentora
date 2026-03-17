import Link from 'next/link'
import { useRouter } from 'next/router'
import { Shield, Home, Users, Map, CreditCard, LogOut, Radio } from 'lucide-react'
// Light theme only

export function AppHeader({ title = 'Zentora', role }: { title?: string; role?: 'admin'|'tourist'|'police'|string|undefined }) {
  const router = useRouter()
  const logout = () => { try { localStorage.removeItem('token'); router.replace('/login') } catch {} }
  return (
  <header className="flex items-center justify-between mb-4 py-2">
      <div className="flex items-center gap-2">
        <Shield size={20} className="text-neutral-700" />
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Link className="px-3 py-1.5 rounded-lg border border-neutral-300 flex items-center gap-1 bg-white text-black" href="/"><Home size={16} /> Home</Link>
        {role === 'admin' && (
          <>
            <Link className="px-3 py-1.5 rounded-lg border border-neutral-300 flex items-center gap-1 bg-white text-black" href="/admin/users"><Users size={16} /> Users</Link>
            <Link className="px-3 py-1.5 rounded-lg border border-neutral-300 flex items-center gap-1 bg-white text-black" href="/admin/ids"><CreditCard size={16} /> IDs</Link>
            <Link className="px-3 py-1.5 rounded-lg border border-neutral-300 flex items-center gap-1 bg-white text-black" href="/admin/geofences"><Map size={16} /> Geofences</Link>
            <Link className="px-3 py-1.5 rounded-lg border border-neutral-300 flex items-center gap-1 bg-white text-black" href="/admin/rfid"><Radio size={16} /> RFID</Link>
          </>
        )}
        <button onClick={logout} className="px-3 py-1.5 rounded-lg border border-neutral-300 flex items-center gap-1 bg-white text-black"><LogOut size={16} /> Logout</button>
      </div>
    </header>
  )
}

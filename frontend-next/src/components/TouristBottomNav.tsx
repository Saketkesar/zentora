import Link from 'next/link'
import { useRouter } from 'next/router'
import { Home, Map, AlertCircle, User } from 'lucide-react'

export function TouristBottomNav() {
  const router = useRouter()
  const isActive = (path: string) => router.pathname === path
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-neutral-200 px-4 py-3 flex items-center justify-around md:hidden">
      <Link 
        href="/tourist/dashboard" 
        className={`flex flex-col items-center gap-1 text-xs font-semibold transition-colors ${isActive('/tourist/dashboard') ? 'text-blue-600' : 'text-neutral-600 hover:text-blue-500'}`}
      >
        <Home size={24} />
        <span>Dashboard</span>
      </Link>
      <Link 
        href="/tourist/map" 
        className={`flex flex-col items-center gap-1 text-xs font-semibold transition-colors ${isActive('/tourist/map') ? 'text-blue-600' : 'text-neutral-600 hover:text-blue-500'}`}
      >
        <Map size={24} />
        <span>Map</span>
      </Link>
      <Link 
        href="/tourist/complaints" 
        className={`flex flex-col items-center gap-1 text-xs font-semibold transition-colors ${isActive('/tourist/complaints') ? 'text-blue-600' : 'text-neutral-600 hover:text-blue-500'}`}
      >
        <AlertCircle size={24} />
        <span>Complaints</span>
      </Link>
      <Link 
        href="/tourist/profile" 
        className={`flex flex-col items-center gap-1 text-xs font-semibold transition-colors ${isActive('/tourist/profile') ? 'text-blue-600' : 'text-neutral-600 hover:text-blue-500'}`}
      >
        <User size={24} />
        <span>Profile</span>
      </Link>
    </nav>
  )
}

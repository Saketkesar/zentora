import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from './Avatar'

export type TouristIdCardProps = {
  name?: string | null
  maskedId?: string | null
  profilePhotoUrl?: string | null
  qrUrl?: string | null
  validFrom?: string | null
  validTo?: string | null
}

// Utility: mask name like "SAK** KET% %$" style inspiration (not exact)
function maskName(input?: string | null) {
  if (!input) return '—'
  const parts = input.trim().split(/\s+/)
  const masked = parts.map(p => p.length <= 2 ? p : p.slice(0, 3).toUpperCase() + '*'.repeat(Math.min(2, Math.max(0, p.length - 3))))
  return masked.join(' ')
}

export function TouristIdCard({ name, maskedId, profilePhotoUrl, qrUrl, validFrom, validTo }: TouristIdCardProps) {
  const [flipped, setFlipped] = useState(false)
  const [now, setNow] = useState<number>(Date.now())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // countdown to end
  const countdown = useMemo(() => {
    if (!validTo) return '—'
    const ms = Math.max(0, new Date(validTo).getTime() - now)
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }, [now, validTo])

  // swipe gesture
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let startX = 0
    let touching = false

    const onTouchStart = (e: TouchEvent) => { touching = true; startX = e.touches[0].clientX }
    const onTouchMove = (e: TouchEvent) => {}
    const onTouchEnd = (e: TouchEvent) => {
      if (!touching) return
      const endX = (e.changedTouches && e.changedTouches[0]?.clientX) || startX
      const dx = endX - startX
      if (Math.abs(dx) > 40) setFlipped(f => !f)
      touching = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const flip = () => {
    setFlipped(f => !f)
    try { if (navigator && 'vibrate' in navigator) (navigator as any).vibrate?.(10) } catch {}
  }

  return (
    <div className="w-full flex justify-center">
      <div ref={containerRef} className="relative w-full max-w-[540px] h-[250px] [perspective:1000px] select-none" onClick={flip}>
        <div className={`absolute inset-0 transition-transform duration-500 ease-out [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
          {/* Front */}
          <div className="absolute inset-0 rounded-2xl bg-white text-black dark:bg-neutral-900 dark:text-white shadow-md border border-neutral-200 dark:border-neutral-800 p-5 [backface-visibility:hidden]">
            <div className="flex items-start gap-4">
              <Avatar src={profilePhotoUrl || undefined} alt="profile" size={84} className="w-[84px] h-[84px] rounded-xl" />
              <div className="flex-1">
                <div className="text-2xl font-extrabold">Tourist ID</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl || '/placeholder-qr.png'} alt="qr" className="w-[96px] h-[96px] ml-auto mt-2 bg-neutral-200 dark:bg-neutral-800 rounded" loading="lazy" onError={(e)=>{ const t=e.target as HTMLImageElement; t.onerror=null; t.src='/placeholder-qr.png' }} />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xl font-semibold">{maskedId || maskName(name)}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">Valid from {validFrom ? new Date(validFrom).toLocaleDateString() : '—'} to {validTo ? new Date(validTo).toLocaleDateString() : '—'}</div>
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 rounded-2xl bg-white text-black dark:bg-neutral-900 dark:text-white shadow-md border border-neutral-200 dark:border-neutral-800 p-5 [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <div className="text-xl font-extrabold">INSTRUCTIONS</div>
            <ul className="mt-3 text-sm space-y-2 list-disc pl-5">
              <li>Keep this identification visible at all times.</li>
              <li>Report any suspicious activity to authorities.</li>
              <li>Activation of this card does not guarantee entry.</li>
            </ul>
            <div className="mt-6 text-xs text-neutral-500">Swipe left/right to flip</div>
          </div>
        </div>
      </div>
    </div>
  )
}

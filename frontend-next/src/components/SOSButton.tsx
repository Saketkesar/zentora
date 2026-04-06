import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { AlertTriangle, Loader2, SignalHigh, Battery, Wifi } from 'lucide-react'

const HOLD_MS = 3500

type Variant = 'bar' | 'fab'

export function SOSButton({ variant = 'bar' }: { variant?: Variant }) {
  const [progress, setProgress] = useState(0)
  const [sending, setSending] = useState(false)
  const timerRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [])

  const getMeta = async () => {
    // Location
    const coords = await new Promise<{ lat?: number, lng?: number }>((resolve) => {
      if (!('geolocation' in navigator)) return resolve({})
      const id = navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
      )
    })
    // Battery
    let batteryPct: number | undefined
    try {
      // @ts-ignore: navigator.getBattery is experimental
      if (navigator.getBattery) {
        // @ts-ignore
        const b = await navigator.getBattery()
        batteryPct = Math.round((b.level || 0) * 100)
      }
    } catch {}
    // Network
    // @ts-ignore
    const connection = (navigator as any).connection || {}
    const network = connection.effectiveType || (navigator.onLine ? 'online' : 'offline')
    return { ...coords, battery: batteryPct, network }
  }

  const sendSOS = async () => {
    setSending(true)
    try {
      const meta = await getMeta()
      await api('/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sos', ...meta })
      })
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          if (Notification.permission === 'default') {
            const res: any = Notification.requestPermission && Notification.requestPermission()
            if (res && typeof res.then === 'function') {
              await res.catch(()=>{})
            }
          }
          if (Notification.permission === 'granted') new Notification('Zentora', { body: 'SOS sent to authorities' })
        } catch {}
      }
      alert('SOS sent')
    } catch (e) {
      alert('Failed to send SOS')
    } finally {
      setSending(false)
      setProgress(0)
    }
  }

  const startHold = () => {
    if (sending) return
    startRef.current = Date.now()
    setProgress(0)
    timerRef.current = window.setInterval(() => {
      if (!startRef.current) return
      const elapsed = Date.now() - startRef.current
      const p = Math.min(1, elapsed / HOLD_MS)
      setProgress(p)
      if (p >= 1) {
        cancelHold()
        void sendSOS()
      }
    }, 50)
  }

  const cancelHold = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    startRef.current = null
    setProgress(0)
  }

  const pct = Math.round(progress * 100)

  const content = (
    <div
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        className={
          variant === 'fab'
            ? 'relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-800 text-white text-sm sm:text-base font-bold select-none active:scale-95 transition-transform flex flex-col items-center justify-center gap-1 overflow-hidden shadow-2xl ring-1 ring-white/10'
            : 'relative w-full py-6 rounded-2xl bg-gray-800 text-white text-xl font-bold select-none active:opacity-90 flex flex-col items-center justify-center gap-2 overflow-hidden shadow-lg'
        }
        aria-label="Hold to send SOS"
      >
        {/* Subtle glow */}
        <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent_60%)] ${pct>0 || sending ? 'opacity-100' : 'opacity-70'} transition-opacity duration-300`} />

        {/* Pulse ring while holding */}
        {pct > 0 && !sending && (
          <div className={`pointer-events-none absolute ${variant==='fab'?'w-16 h-16 sm:w-20 sm:h-20':'w-64 h-64'} rounded-full border border-white/20 animate-ping`} />
        )}

        {/* Icon row showing captured meta visually */}
        {variant === 'bar' && (
          <div className="flex items-center gap-4 text-white/90">
            <SignalHigh size={18} />
            <Wifi size={18} />
            <Battery size={18} />
          </div>
        )}

        {/* Main label */}
        <div className="flex items-center gap-2">
          {sending ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <AlertTriangle size={22} className="shrink-0" />
          )}
          <div className="text-center drop-shadow">{sending ? 'Sending…' : (pct > 0 ? `Hold… ${pct}%` : (variant==='fab'?'SOS':'EMERGENCY SOS'))}</div>
        </div>

        {/* Linear progress bar */}
        {variant === 'bar' && (
          <div className="absolute inset-x-0 -bottom-1 h-1 bg-rose-800/40">
            <div className="h-full bg-white transition-[width] duration-75" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
  )

  if (variant === 'fab') {
    return (
      <div className="pointer-events-auto" aria-live="polite">
        {content}
        <p className="text-[10px] mt-1 text-center text-neutral-300">Hold to send</p>
      </div>
    )
  }

  return (
    <div className="w-full" aria-live="polite">
      {content}
      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 text-center">Hold for 3–4 seconds to confirm</p>
    </div>
  )
}

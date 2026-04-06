import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/router'
import { api } from '../../src/lib/api'

type Step = 'front' | 'back' | 'review'

export default function Kyc() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [step, setStep] = useState<Step>('front')
  const [frontBlob, setFrontBlob] = useState<Blob | null>(null)
  const [backBlob, setBackBlob] = useState<Blob | null>(null)
  const [stable, setStable] = useState(false)
  const [autoCapturing, setAutoCapturing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const playBeep = () => {
    try {
      const AudioCtx: any = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.value = 0.04
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.12)
      osc.onended = () => { try { ctx.close() } catch {} }
    } catch {}
  }
  // If KYC already pending/approved, redirect back to dashboard (one-time submission)
  useEffect(() => {
    (async () => {
      try {
        const r = await api('/api/tourist/me')
        if (r.ok) {
          const me = await r.json()
          if (me?.kyc_status === 'pending' || me?.kyc_status === 'approved') {
            router.replace('/tourist/dashboard')
            return
          }
        }
      } catch {}
    })()
  }, [])

  // Start camera once
  useEffect(() => {
    let raf = 0
    let lastImgData: ImageData | null = null
    let stableFrames = 0
    const start = async () => {
      try {
        setError(null)
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const analyze = () => {
          const v = videoRef.current
          const c = canvasRef.current
          if (!v || !c) return
          const w = c.width = 320
          const h = c.height = 240
          const ctx = c.getContext('2d')!
          ctx.drawImage(v, 0, 0, w, h)
          const img = ctx.getImageData(0, 0, w, h)
          // Compute simple frame difference to detect stability
          if (lastImgData && lastImgData.data.length === img.data.length) {
            let diff = 0
            for (let i = 0; i < img.data.length; i += 20) { // sample down
              diff += Math.abs(img.data[i] - lastImgData.data[i])
            }
            const avgDiff = diff / (img.data.length / 20)
            if (avgDiff < 2.5) stableFrames++
            else stableFrames = 0
          }
          lastImgData = img
          const isStable = stableFrames > 12 // ~0.5s stable
          setStable(isStable)
          if (isStable && !autoCapturing) {
            setAutoCapturing(true)
            // Auto-capture after a brief hold if still stable
            setTimeout(() => {
              capture('auto')
            }, 400)
          }
          raf = requestAnimationFrame(analyze)
        }
        raf = requestAnimationFrame(analyze)
      } catch (e: any) {
        setError(e?.message || 'Camera access failed')
      }
    }
    start()
    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Stop stream when moving to review
  useEffect(() => {
    if (step === 'review') {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [step])

  const capture = (mode: 'auto' | 'manual' = 'manual') => {
    const v = videoRef.current
    const c = canvasRef.current
    if (!v || !c || v.readyState < 2) {
      setError('Camera not ready yet')
      setAutoCapturing(false)
      return
    }
    const w = v.videoWidth || 1280
    const h = v.videoHeight || 720
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0, w, h)
    if (mode === 'auto') playBeep()
    c.toBlob((blob) => {
      if (!blob) return
      if (step === 'front') {
        setFrontBlob(blob)
        setStep('back')
      } else if (step === 'back') {
        setBackBlob(blob)
        setStep('review')
      }
      setAutoCapturing(false)
    }, 'image/jpeg', 0.9)
  }

  const retake = (which: 'front' | 'back') => {
    if (which === 'front') setFrontBlob(null)
    else setBackBlob(null)
    setStep(which)
    setAutoCapturing(false)
  }

  const submit = async () => {
    if (!frontBlob || !backBlob) return alert('Capture both sides')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('front', new File([frontBlob], 'personal_id_front.jpg', { type: 'image/jpeg' }))
      fd.append('back', new File([backBlob], 'personal_id_back.jpg', { type: 'image/jpeg' }))
      const res = await api('/api/kyc/aadhaar', { method: 'POST', body: fd })
      if (res.ok) {
        router.replace('/tourist/dashboard?flash=kyc_submitted')
      } else {
        const txt = await res.text().catch(()=>null)
        alert(`Failed to submit${txt ? `: ${txt}` : ''}`)
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen text-black px-4 py-6">
      <Head><title>Personal ID Verification - Zentora</title></Head>
      <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2 font-display"><Camera size={18} /> Personal ID Verification</h1>
          <p className="text-sm text-neutral-600">Align your ID inside the frame. We auto-capture when steady.</p>
        </div>
        <Link className="px-3 py-1.5 rounded-full border border-neutral-300 text-sm bg-white/80" href="/tourist/dashboard">Back</Link>
      </header>

      {step !== 'review' && (
        <div className="max-w-md mx-auto animate-slide-up">
          <div className="text-sm mb-2">Capture the {step} side</div>
          <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-white shadow-[0_8px_30px_-20px_rgba(15,23,42,0.35)]">
            <video ref={videoRef} playsInline muted autoPlay className="w-full h-auto block bg-black" />
            {/* Guidance rectangle overlay */}
            <div className={`absolute inset-6 rounded-md ${stable ? 'border-2 border-emerald-500 shadow-[0_0_0_9999px_rgba(16,185,129,0.12)]' : 'border-2 border-rose-500 shadow-[0_0_0_9999px_rgba(244,63,94,0.08)]'} pointer-events-none transition-colors duration-200`}></div>
            {/* Scan line animation */}
            <div className="absolute inset-x-6 top-6 h-0.5 bg-white/40 animate-pulse" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex items-center justify-between mt-3">
            <button onClick={()=>capture('manual')} className="px-4 py-2 rounded-full bg-black text-white flex items-center gap-2"><CheckCircle2 size={16} /> Capture</button>
            <button onClick={()=>setAutoCapturing(false)} className="px-3 py-2 rounded-full border border-neutral-300 bg-white/80 flex items-center gap-2"><RefreshCw size={16} /> Reset</button>
          </div>
          <div className="text-xs text-neutral-600 mt-2">Auto-capture plays a soft beep. Use the button if needed.</div>
          {error && (
            <div className="text-sm text-rose-600 mt-2 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={()=>location.reload()} className="px-3 py-1 rounded border border-rose-400 text-rose-700 dark:text-rose-300">Restart camera</button>
            </div>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="max-w-md mx-auto grid gap-3 animate-slide-up">
          <div className="text-sm">Review & submit</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1">Front</div>
              {frontBlob && <img className="rounded border border-neutral-200" src={URL.createObjectURL(frontBlob)} alt="Front" />}
              <button onClick={()=>retake('front')} className="mt-2 text-xs underline">Retake</button>
            </div>
            <div>
              <div className="text-xs mb-1">Back</div>
              {backBlob && <img className="rounded border border-neutral-200" src={URL.createObjectURL(backBlob)} alt="Back" />}
              <button onClick={()=>retake('back')} className="mt-2 text-xs underline">Retake</button>
            </div>
          </div>
          <button disabled={loading} onClick={submit} className="px-4 py-2 rounded-full bg-black text-white flex items-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Submit
          </button>
        </div>
      )}
    </div>
  )
}

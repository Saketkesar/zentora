import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Loader2 } from 'lucide-react'
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
        const r = await api('/tourist/me')
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
    const start = async () => {
      try {
        setError(null)
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (e: any) {
        setError(e?.message || 'Camera access failed')
      }
    }

    start()
    return () => {
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
    if (!v || !c) {
      setError('Camera not available')
      return
    }
    
    if (v.readyState < 2) {
      setError('Camera still loading... try again in a moment')
      return
    }
    
    const w = v.videoWidth || 1280
    const h = v.videoHeight || 720
    
    if (!w || !h) {
      setError('Video dimensions not available yet')
      return
    }
    
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) {
      setError('Canvas context failed')
      return
    }
    
    try {
      ctx.drawImage(v, 0, 0, w, h)
    } catch (err) {
      setError('Failed to capture video frame')
      return
    }
    
    playBeep()
    
    c.toBlob((blob) => {
      if (!blob) {
        setError('Failed to encode image')
        return
      }
      if (step === 'front') {
        setFrontBlob(blob)
        setStep('back')
      } else if (step === 'back') {
        setBackBlob(blob)
        setStep('review')
      }
      setError(null)
    }, 'image/jpeg', 0.9)
  }

  const retake = (which: 'front' | 'back') => {
    if (which === 'front') setFrontBlob(null)
    else setBackBlob(null)
    setStep(which)
  }

  const submit = async () => {
    if (!frontBlob || !backBlob) return alert('Capture both sides')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('front', new File([frontBlob], 'personal_id_front.jpg', { type: 'image/jpeg' }))
      fd.append('back', new File([backBlob], 'personal_id_back.jpg', { type: 'image/jpeg' }))
      const res = await api('/kyc/aadhaar', { method: 'POST', body: fd })
      if (res.ok) {
        router.replace('/tourist/dashboard?flash=kyc_submitted')
      } else {
        const txt = await res.text().catch(() => null)
        alert(`Failed to submit${txt ? `: ${txt}` : ''}`)
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen text-black px-4 py-6">
      <Head><title>Personal ID Verification - Zentora</title></Head>
      <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Camera size={18} /> Personal ID Verification</h1>
          <p className="text-sm text-neutral-600">Align your ID inside the frame and click Capture.</p>
        </div>
        <Link className="px-3 py-1.5 rounded-full border border-neutral-300 text-sm bg-white/80" href="/tourist/dashboard">Back</Link>
      </header>

      {step !== 'review' && (
        <div className="max-w-md mx-auto">
          <div className="text-sm mb-2">Capture the {step} side</div>
          <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-white shadow-[0_8px_30px_-20px_rgba(15,23,42,0.35)]">
            <video ref={videoRef} playsInline muted autoPlay className="w-full h-auto block bg-black" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="mt-3">
            <button onClick={() => capture('manual')} className="w-full px-4 py-2 rounded-full bg-black text-white flex items-center justify-center gap-2 font-medium">
              <CheckCircle2 size={16} /> Capture {step}
            </button>
          </div>
          <div className="text-xs text-neutral-600 mt-2 text-center">Click button to capture</div>
          {error && (
            <div className="text-sm text-rose-600 mt-2 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => location.reload()} className="px-3 py-1 rounded border border-rose-400 text-rose-700">
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="max-w-md mx-auto grid gap-3">
          <div className="text-sm">Review and submit</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1">Front</div>
              {frontBlob && <img className="rounded border border-neutral-200" src={URL.createObjectURL(frontBlob)} alt="Front" />}
              <button onClick={() => retake('front')} className="mt-2 text-xs underline">Retake</button>
            </div>
            <div>
              <div className="text-xs mb-1">Back</div>
              {backBlob && <img className="rounded border border-neutral-200" src={URL.createObjectURL(backBlob)} alt="Back" />}
              <button onClick={() => retake('back')} className="mt-2 text-xs underline">Retake</button>
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

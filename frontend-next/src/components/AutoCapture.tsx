import React, { useRef, useEffect, useState } from 'react'
import { Camera, RefreshCw, CheckCircle2 } from 'lucide-react'
import { playBeep } from '../lib/audioUtils'

interface AutoCaptureProps {
  onCapture: (blob: Blob) => void
  side?: string
  facingMode?: 'user' | 'environment'
  className?: string
  showGuide?: boolean
}

export const AutoCapture = ({ 
  onCapture, 
  side = 'front', 
  facingMode = 'environment',
  className = '',
  showGuide = true 
}: AutoCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  const [stable, setStable] = useState(false)
  const [autoCapturing, setAutoCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let raf = 0
    let lastImgData: ImageData | null = null
    let stableFrames = 0

    const start = async () => {
      try {
        setError(null)
        // More flexible constraints that work on most devices
        const constraints: any = { 
          video: { 
            width: { ideal: 1280, min: 320 },
            height: { ideal: 720, min: 240 },
            facingMode: facingMode === 'user' ? 'user' : 'environment'
          }, 
          audio: false 
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => setError(`Playback failed: ${e.message}`))
          }
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

          // Compute frame difference for stability detection
          if (lastImgData && lastImgData.data.length === img.data.length) {
            let diff = 0
            for (let i = 0; i < img.data.length; i += 20) {
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
            setTimeout(() => {
              capture('auto')
            }, 400)
          }

          raf = requestAnimationFrame(analyze)
        }

        raf = requestAnimationFrame(analyze)
      } catch (e: any) {
        const errMsg = e?.message || 'Camera access failed'
        // Provide helpful hints based on error type
        let fullError = errMsg
        if (errMsg.includes('Permission')) {
          fullError = `Camera permission denied. Please allow camera access in your browser settings.`
        } else if (errMsg.includes('NotFound')) {
          fullError = `No camera found. Please check if your device has a camera.`
        } else if (errMsg.includes('NotReadable')) {
          fullError = `Camera is in use by another application. Please close other apps using the camera.`
        } else if (errMsg.includes('NotAllowed')) {
          fullError = `Camera access blocked. Check browser permissions.`
        } else if (errMsg.includes('TypeError')) {
          fullError = `getUserMedia not supported in this browser. Please use Chrome, Firefox, or Safari.`
        }
        setError(fullError)
      }
    }

    start()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [autoCapturing])

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
      onCapture(blob)
      setAutoCapturing(false)
    }, 'image/jpeg', 0.9)
  }

  const reset = () => {
    setAutoCapturing(false)
    setStable(false)
  }

  const retry = () => {
    setError(null)
    setAutoCapturing(false)
    setStable(false)
    // Trigger re-initialization
    window.location.reload()
  }

  return (
    <div className={`grid gap-3 ${className}`}>
      <div className="relative rounded-2xl overflow-hidden border-2 border-neutral-200 bg-black shadow-lg">
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          autoPlay 
          className="w-full h-auto block"
        />
        
        {/* Guidance rectangle overlay */}
        <div className={`absolute inset-4 rounded-lg pointer-events-none transition-all duration-300 ${
          stable 
            ? 'border-2 border-emerald-500 shadow-[0_0_0_9999px_rgba(16,185,129,0.1)] scale-100' 
            : 'border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(251,146,60,0.08)] scale-95'
        }`} />
        
        {/* Scan line animation */}
        {!stable && (
          <div className="absolute inset-x-4 top-1/3 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
        )}

        {/* Status indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${stable ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-xs font-medium text-white bg-black/60 px-2 py-1 rounded">
            {stable ? 'STEADY' : 'MOVE STEADY'}
          </span>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={() => capture('manual')}
          className="flex-1 px-4 py-3 rounded-lg bg-black text-white font-medium flex items-center justify-center gap-2 hover:bg-neutral-900 transition-colors duration-200 shadow-md"
        >
          <CheckCircle2 size={18} /> Capture {side}
        </button>
        <button 
          onClick={reset}
          className="px-4 py-3 rounded-lg border-2 border-neutral-300 bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-neutral-50 transition-colors duration-200"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <p className="text-xs text-neutral-600 text-center">
        Auto-capture when frame is steady. Manual capture always available.
      </p>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border-2 border-rose-200">
          <div className="text-sm font-semibold text-rose-900 mb-3">
            📷 Camera Error
          </div>
          <div className="text-sm text-rose-800 mb-4 leading-relaxed">
            {error}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={retry}
              className="flex-1 text-sm font-medium px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
            >
              Try Again
            </button>
            <button 
              onClick={() => location.reload()}
              className="flex-1 text-sm font-medium px-4 py-2 border-2 border-rose-200 text-rose-700 rounded hover:bg-rose-100 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

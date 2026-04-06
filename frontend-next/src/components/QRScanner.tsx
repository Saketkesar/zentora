import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'

export function QRScanner({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const [scannedData, setScannedData] = useState<any>(null)
  const [userDetails, setUserDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [scanCount, setScanCount] = useState(0)

  // Beep sound on successful scan
  const playBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.value = 880
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.12)
    } catch {}
  }, [])

  // Start camera
  useEffect(() => {
    let isMounted = true
    
    // Load jsQR library from CDN
    if (!(window as any).jsQR) {
      try {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
        document.head.appendChild(script)
      } catch {
        // Fallback if CDN fails
      }
    }

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
          setCameraActive(true)
        }
      } catch (e) {
        if (isMounted) setError('Failed to access camera')
      }
    })()
    return () => {
      isMounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // QR Code detection using jsQR library
  const scanQRCode = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || scanCount >= 3) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Load jsQR library from CDN if not already loaded
    if (!(window as any).jsQR) {
      try {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
        script.onload = () => {
          scanQRCode()
        }
        document.head.appendChild(script)
        return
      } catch {
        // Fallback if CDN fails
      }
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    try {
      const jsQR = (window as any).jsQR
      if (!jsQR) {
        animFrameRef.current = requestAnimationFrame(scanQRCode)
        return
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const qrCode = jsQR(imageData.data, canvas.width, canvas.height)

      if (qrCode && qrCode.data) {
        setScanCount(c => c + 1)
        playBeep()
        setScannedData(qrCode.data)
        // QR code contains the tourist UUID directly
        setLoading(true)
        try {
          const touristUuid = qrCode.data.trim().toLowerCase()
          console.log('Scanned UUID:', touristUuid)
          
          // First, check if UUID exists in database (debug call, no auth needed)
          try {
            const debugRes = await fetch(`/api/proxy/debug/tourist-exists?uuid=${encodeURIComponent(touristUuid)}`)
            const debugData = await debugRes.json()
            console.log('Debug check:', debugData)
          } catch (debugErr) {
            console.warn('Debug check failed:', debugErr)
          }
          
          // Now try the main API call
          const r = await api(`/police/tourist?uuid=${encodeURIComponent(touristUuid)}`)
          console.log('Response status:', r.status, 'ok:', r.ok)
          if (r.ok) {
            const data = await r.json()
            console.log('Tourist data:', data)
            setUserDetails(data)
          } else {
            const errText = await r.text()
            console.error('Error response:', r.status, errText)
            setError(`Error (${r.status}): ${errText || 'API returned error'}`)
          }
        } catch (e: any) {
          console.error('Fetch error:', e)
          setError('Failed to load user details: ' + (e?.message || 'unknown error'))
        } finally {
          setLoading(false)
        }
        return
      }
    } catch (e) {
      // Silently continue scanning
    }

    animFrameRef.current = requestAnimationFrame(scanQRCode)
  }, [playBeep, scanCount])

  // Start scanning when camera is ready
  useEffect(() => {
    if (cameraActive && videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        animFrameRef.current = requestAnimationFrame(scanQRCode)
      }
    }
  }, [cameraActive, scanQRCode])

  const handleReset = () => {
    setScannedData(null)
    setUserDetails(null)
    setError(null)
    setScanCount(0)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <h2 className="text-xl font-semibold">QR Code Scanner</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {!userDetails ? (
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-xl bg-black aspect-square object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                {cameraActive && (
                  <div className="absolute inset-0 rounded-xl border-2 border-blue-500 pointer-events-none">
                    <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-blue-500" />
                    <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-blue-500" />
                    <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-blue-500" />
                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-blue-500" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <Loader2 size={16} className="animate-spin" />
                Point camera at QR code on tourist ID... ({scanCount}/3)
              </div>
              {error && (
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                  {scannedData && (
                    <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-mono text-neutral-700 dark:text-neutral-300 break-all">
                      <div className="text-neutral-600 dark:text-neutral-400 text-xs mb-1">Scanned UUID:</div>
                      {scannedData}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">QR Code verified</span>
                  </div>

                  {/* User Details */}
                  <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3">
                    <h3 className="font-semibold text-lg">User Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-neutral-600 dark:text-neutral-400">Name</div>
                        <div className="font-medium">{userDetails?.name || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-neutral-600 dark:text-neutral-400">Tourist ID</div>
                        <div className="font-medium">{userDetails?.tourist_id || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-neutral-600 dark:text-neutral-400">Phone</div>
                        <div className="font-medium">{userDetails?.phone || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-neutral-600 dark:text-neutral-400">KYC Status</div>
                        <div className={`font-medium px-2 py-1 rounded-md w-fit text-xs ${userDetails?.kyc_status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : userDetails?.kyc_status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                          {userDetails?.kyc_status || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KYC Documents */}
                  {userDetails?.kyc_documents && userDetails.kyc_documents.length > 0 && (
                    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3">
                      <h3 className="font-semibold">KYC Documents</h3>
                      <div className="grid gap-3">
                        {userDetails.kyc_documents.map((doc: any, idx: number) => (
                          <div key={idx} className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                            <div className="p-3 bg-neutral-50 dark:bg-neutral-800 flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{doc.document_type || `Document ${idx + 1}`}</span>
                                <div className="text-xs text-neutral-500 mt-1">Status: {doc.status || 'unknown'}</div>
                              </div>
                            </div>
                            <div className="flex gap-2 p-2 bg-white dark:bg-neutral-900">
                              {doc.front_url && (
                                <a
                                  href={`/api/proxy${doc.front_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                  Front
                                </a>
                              )}
                              {doc.back_url && (
                                <a
                                  href={`/api/proxy${doc.back_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                  Back
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Profile Photo */}
                  {userDetails?.profile_photo_url && (
                    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
                      <h3 className="font-semibold mb-3">Profile Photo</h3>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/proxy${userDetails.profile_photo_url}`}
                        alt="profile"
                        className="w-full max-h-64 rounded-lg object-cover"
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleReset}
                      className="flex-1 px-4 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={16} />
                      Scan Another
                    </button>
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

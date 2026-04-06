import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../src/lib/api'
import { Avatar } from '../../src/components/Avatar'
import { Shield, Radio, BadgeCheck, AlertCircle, Loader2, Users as UsersIcon, Wifi, Zap, CheckCircle, X } from 'lucide-react'
import { useRouter } from 'next/router'

type VerifiedUser = { id: number; name: string; email: string; profile_photo_url?: string | null }
type ReadResult = { ok: boolean; valid: boolean; name: string; email: string; phone: string; tourist_uuid: string; kyc_status: string; kyc_documents: any[]; valid_from: string; valid_to: string; profile_photo_url: string }

export default function AdminRFIDPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<VerifiedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<VerifiedUser | null>(null)
  const [tagId, setTagId] = useState('')
  const [chainId, setChainId] = useState('')
  const [binding, setBinding] = useState(false)
  
  // Read popup state
  const [showReadPopup, setShowReadPopup] = useState(false)
  const [readingStage, setReadingStage] = useState<'placing' | 'reading' | 'success' | 'error'>('placing')
  const [readResult, setReadResult] = useState<ReadResult | null>(null)
  const [readError, setReadError] = useState('')

  // Write popup state
  const [showWritePopup, setShowWritePopup] = useState(false)
  const [writingStage, setWritingStage] = useState<'placing' | 'writing' | 'success' | 'error'>('placing')
  const [writeError, setWriteError] = useState('')

  const [verifications, setVerifications] = useState<any[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Beep sound on success
  const beep = (frequency = 880, duration = 200) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration / 1000)
    } catch (e) {
      console.log('Audio not supported')
    }
  }

  // Close popups and disable modes
  const closeReadPopup = async () => {
    await api('/admin/rfid/mode/off', { method: 'POST' })
    setShowReadPopup(false)
    setReadingStage('placing')
    setReadResult(null)
    setReadError('')
  }

  const closeWritePopup = async () => {
    await api('/admin/rfid/mode/off', { method: 'POST' })
    setShowWritePopup(false)
    setWritingStage('placing')
    setWriteError('')
  }

  useEffect(() => {
    const uid = router.query.user_id
    if (uid && typeof uid === 'string') {
      api(`/admin/users/verified?user_id=${uid}`).then(async r => {
        if (r.ok) {
          const data = await r.json()
          const item = (data.items || [])[0]
          if (item) {
            setSelected(item)
          }
        }
      })
    }
  }, [router.query.user_id])

  // When a user is selected, auto-fill RFID Tag ID with their Tourist UUID
  useEffect(() => {
    const run = async () => {
      if (!selected) return
      try {
        // Get Tourist ID UUID and auto-fill tagId
        const r = await api(`/admin/tourist-ids?user_id=${selected.id}`)
        if (r.ok) {
          const data = await r.json()
          const tid = (data.items || [])[0]
          if (tid?.uuid) {
            setTagId(tid.uuid)
            setChainId(tid.uuid)
          }
        }
      } catch {}
    }
    run()
  }, [selected?.id])

  // Search with debounce
  const search = (q: string) => {
    setQuery(q)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!q.trim()) {
      setUsers([])
      return
    }
    setLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const r = await api(`/admin/users/verified?q=${encodeURIComponent(q)}`)
        if (r.ok) {
          const data = await r.json()
          setUsers(data.items || [])
        }
      } catch {
        setUsers([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  const bind = async () => {
    if (!selected) { alert('Select a tourist first'); return }
    if (!tagId.trim()) { alert('Enter RFID Tag ID'); return }
    setBinding(true)
    try {
      const res = await api('/admin/rfid/bind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: selected.id, tag_id: tagId.trim(), blockchain_id: chainId.trim() || undefined }) })
      if (res.ok) {
        alert('RFID Tag bound successfully!')
      } else {
        alert('Failed to bind RFID tag')
      }
    } finally { 
      setBinding(false)
    }
  }

  // Start Read popup with animation
  const startReadPopup = async () => {
    if (!selected?.id) { alert('Please select a tourist first'); return }
    
    // Enable read mode on backend
    await api('/admin/rfid/mode/read-on', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selected.id })
    })
    
    setReadingStage('placing')
    setReadResult(null)
    setReadError('')
    setShowReadPopup(true)
    
    // Start polling for card (don't jump to reading stage yet)
    waitForCardAndRead()
  }

  const waitForCardAndRead = async () => {
    console.log('🔵 READ: Waiting for card to be placed...')
    
    try {
      let cardResult = null
      let attempts = 0
      
      // STAGE 1: "placing" - Wait for card detection
      while (!cardResult && attempts < 60) { // 60 * 500ms = 30 seconds
        try {
          const readRes = await api('/rfid/last-read')
          
          if (readRes.ok) {
            const result = await readRes.json()
            console.log('🔵 READ: Poll #' + attempts + ':', result)
            // Check if result is actual data (not just {ok: false})
            if (result && result.ok && result.user_id) {
              cardResult = result
              break
            }
          }
        } catch (e) {
          // Keep polling
          console.log('🔵 READ: Waiting... (' + attempts + '/60)')
        }
        
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
      }
      
      if (!cardResult) {
        // Timeout - no card detected
        console.log('❌ READ: Timeout - no card detected')
        setReadError('No card detected (timeout 30s)')
        setReadingStage('error')
        beep(400, 300)
        return
      }
      
      // STAGE 2: "reading" - Card detected!
      console.log('✅ READ: Card detected! Moving to reading stage...')
      setReadingStage('reading')
      
      // Show success
      setReadResult(cardResult)
      setReadingStage('success')
      beep(880, 200)
      beep(880, 200)
      beep(880, 200)
    } catch (e) {
      console.error('❌ READ Error:', e)
      setReadError('Error reading card: ' + (e as any).message)
      setReadingStage('error')
      beep(400, 300)
    }
  }

  // Start Write popup with animation
  const startWritePopup = async () => {
    if (!selected?.id) { alert('Please select a tourist first'); return }
    
    // Enable write mode on backend
    await api('/admin/rfid/mode/write-on', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selected.id })
    })
    
    setWritingStage('placing')
    setWriteError('')
    setShowWritePopup(true)
    
    // Start polling for card (don't jump to writing stage yet)
    waitForCardAndWrite()
  }

  const waitForCardAndWrite = async () => {
    console.log('🟣 WRITE: Waiting for card to be placed...')
    
    try {
      // Get UUID to write
      const getRes = await api(`/rfid/write/get-uuid?user_id=${selected?.id}`)
      if (!getRes.ok) {
        setWriteError('Failed to get UUID')
        setWritingStage('error')
        beep(400, 300)
        return
      }
      
      const { uuid } = await getRes.json()
      console.log('🟣 WRITE: UUID to write:', uuid)
      setTagId(uuid)
      
      let cardWritten = null
      let attempts = 0
      
      // STAGE 1: "placing" - Wait for card detection
      while (!cardWritten && attempts < 60) { // 60 * 500ms = 30 seconds
        try {
          const writeCheckRes = await api('/rfid/last-write')
          if (writeCheckRes.ok) {
            const writeCheck = await writeCheckRes.json()
            console.log('🟣 WRITE: Poll #' + attempts + ':', writeCheck)
            if (writeCheck && writeCheck.uuid === uuid) {
              cardWritten = true
              break
            }
          }
        } catch (e) {
          // Keep polling
          console.log('🟣 WRITE: Waiting... (' + attempts + '/60)')
        }
        
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
      }
      
      if (!cardWritten) {
        // Timeout - no card detected
        console.log('❌ WRITE: Timeout - no card detected')
        setWriteError('No card detected - timeout (30s)')
        setWritingStage('error')
        beep(400, 300)
        return
      }
      
      // STAGE 2: "writing" - Card detected!
      console.log('✅ WRITE: Card detected! Moving to writing stage...')
      setWritingStage('writing')
      
      // Now create the binding in database
      const bindRes = await api('/admin/rfid/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selected?.id,
          tag_id: uuid,
          blockchain_id: uuid
        })
      })
      
      if (bindRes.ok) {
        // Show success
        setWritingStage('success')
        beep(880, 200)
        beep(880, 200)
        beep(880, 200)
      } else {
        setWriteError('Failed to bind card')
        setWritingStage('error')
        beep(400, 300)
      }
    } catch (e) {
      console.error('❌ WRITE Error:', e)
      setWriteError('Error writing tag: ' + (e as any).message)
      setWritingStage('error')
      beep(400, 300)
    }
  }

  // Live verification feed via WebSocket
  useEffect(() => {
    const loc = typeof window !== 'undefined' ? window.location : null
    if (!loc) return
    const proto = loc.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${loc.host.replace(':3000', ':8001')}/ws/rfid`
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.event === 'rfid_scan' && msg.data) {
          const data = msg.data
          setVerifications(v => [{...data, ts: Date.now()}, ...v].slice(0, 20))
          setTagId(prev => prev && prev.length ? prev : (data.tag_id || ''))
        }
      } catch {}
    }
    return () => { ws.close() }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-black px-3 sm:px-4 py-6">
      <Head><title>RFID - Admin</title></Head>
      
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3"><Radio className="text-purple-600" size={28} /> RFID Tag Manager</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/users" className="px-3 py-2 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50 transition-colors inline-flex items-center gap-2 text-sm font-medium"><UsersIcon size={16} /> Users</Link>
          <Link href="/admin/dashboard" className="px-3 py-2 rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-50 transition-colors inline-flex items-center gap-2 text-sm font-medium"><Shield size={16} /> Dashboard</Link>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {/* Left: Bind section */}
        <section className="md:col-span-2 p-6 rounded-2xl bg-white border-2 border-neutral-200 shadow-sm">
          <div className="text-lg font-bold mb-6 flex items-center gap-2"><Wifi size={20} className="text-blue-600" /> RFID Binding</div>
          
          {/* Search */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-neutral-700 mb-3">Search Tourist</label>
            <div className="relative">
              <input 
                value={query} 
                onChange={e => search(e.target.value)} 
                placeholder="Search by name, email or phone..." 
                className="w-full px-4 py-3 rounded-lg border-2 border-neutral-300 focus:outline-none focus:border-blue-500 transition-colors" 
              />
              {loading && <Loader2 className="absolute right-3 top-3 animate-spin text-neutral-400" size={20} />}
            </div>

            {/* Search Results */}
            {query && (
              <div className="mt-3 max-h-56 overflow-auto rounded-lg border-2 border-neutral-200 bg-neutral-50">
                {users.length === 0 ? (
                  <div className="p-4 text-center text-sm text-neutral-500">No tourists found</div>
                ) : (
                  users.map(u => (
                    <button 
                      key={u.id} 
                      onClick={() => {
                        setSelected(u)
                        setQuery('')
                        setUsers([])
                      }} 
                      className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${selected?.id === u.id ? 'bg-blue-100' : 'hover:bg-neutral-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={u.profile_photo_url ? `/api/proxy${u.profile_photo_url}` : undefined} alt={u.name} size={32} className="w-8 h-8 rounded-lg" />
                        <div>
                          <div className="font-semibold text-sm">{u.name}</div>
                          <div className="text-xs text-neutral-500">{u.email}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Tourist Details */}
          {selected && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                <div className="flex items-center gap-3">
                  <Avatar src={selected.profile_photo_url ? `/api/proxy${selected.profile_photo_url}` : undefined} alt={selected.name} size={40} className="w-10 h-10 rounded-lg" />
                  <div>
                    <div className="font-semibold text-sm">{selected.name}</div>
                    <div className="text-xs text-neutral-600">{selected.email}</div>
                  </div>
                </div>
              </div>

              {/* Auto-filled RFID Tag ID */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-2">RFID Tag ID (Auto-filled from Tourist UUID)</label>
                <input 
                  value={tagId} 
                  onChange={e => setTagId(e.target.value)} 
                  placeholder="Auto-filled..." 
                  className="w-full px-4 py-2 rounded-lg border-2 border-neutral-300 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors bg-neutral-50" 
                  readOnly
                />
                <p className="text-xs text-neutral-500 mt-2">This UUID will be written to the RFID card</p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={bind} 
                  disabled={binding} 
                  className="px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  {binding ? (
                    <>
                      <Loader2 size={16} className="animate-spin"/> Binding
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} /> Bind
                    </>
                  )}
                </button>
                <button 
                  onClick={startReadPopup}
                  className="px-4 py-3 rounded-lg border-2 border-green-300 hover:bg-green-50 font-semibold inline-flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <Wifi size={16} /> Read
                </button>
                <button 
                  onClick={startWritePopup}
                  className="px-4 py-3 rounded-lg border-2 border-purple-300 hover:bg-purple-50 font-semibold inline-flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <Zap size={16} /> Write
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right: Live Feed */}
        <section className="p-6 rounded-2xl bg-white border-2 border-neutral-200 shadow-sm">
          <div className="text-lg font-bold mb-2 flex items-center gap-2"><Zap size={20} className="text-purple-600" /> Live Feed</div>
          <p className="text-xs text-neutral-600 mb-4">Real-time verification events from checkpoints</p>
          <div className="grid gap-2 max-h-96 overflow-auto">
            {verifications.length === 0 ? (
              <div className="p-6 text-center rounded-lg bg-neutral-50 border-2 border-dashed border-neutral-300">
                <Radio className="inline-block mb-2 text-neutral-300" size={32} />
                <p className="text-neutral-500 text-xs">Waiting for events...</p>
              </div>
            ) : (
              verifications.map(v => (
                <div 
                  key={v.ts + v.tag_id} 
                  className={`p-3 rounded-lg border-2 text-xs animate-[pulse_0.6s_ease-out_1] ${v.valid ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-mono font-bold text-xs text-black">{v.tag_id}</div>
                    <div className={`px-2 py-1 rounded text-xs font-semibold ${
                      v.valid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {v.valid ? 'VALID' : 'INVALID'}
                    </div>
                  </div>
                  <div className="font-medium text-xs">{v.name_masked || 'Unknown'}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* READ POPUP - Card Tap Animation */}
      {showReadPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            {/* Close Button */}
            <button 
              onClick={closeReadPopup}
              className="absolute top-4 right-4 p-2 hover:bg-neutral-100 rounded-full transition-colors"
            >
              <X size={20} className="text-neutral-600" />
            </button>

            {readingStage === 'placing' && (
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-28 h-40 mx-auto bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl flex items-center justify-center relative border-2 border-emerald-200">
                    {/* Card Shadow/3D Effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent"></div>
                    <div className="absolute inset-2 rounded-xl border-2 border-emerald-300/50"></div>
                    <div className="text-center z-10">
                      <Wifi className="mx-auto text-emerald-600 mb-2 animate-pulse" size={32} />
                      <div className="text-xs font-bold text-emerald-700">RFID Card</div>
                    </div>
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Ready to Read</h2>
                <p className="text-neutral-600 mb-2">Tap the RFID card on the reader</p>
                <div className="text-sm text-neutral-500 animate-pulse">Waiting for card...</div>
              </div>
            )}

            {readingStage === 'reading' && (
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-28 h-40 mx-auto bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center relative border-2 border-blue-300 animate-bounce">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent"></div>
                    <div className="absolute inset-2 rounded-xl border-2 border-blue-300/50"></div>
                    <Loader2 className="text-blue-600 animate-spin z-10" size={32} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Reading Card</h2>
                <p className="text-neutral-600">Please hold steady...</p>
              </div>
            )}

            {readingStage === 'success' && readResult && (
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="bg-emerald-100 rounded-full p-3">
                    <BadgeCheck className="text-emerald-600" size={32} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-4">Card Read Successfully</h2>
                
                <div className="bg-neutral-50 rounded-lg p-4 text-left mb-4 max-h-48 overflow-auto">
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-neutral-600 mb-1">Tourist Name</div>
                    <div className="font-bold text-black">{readResult.name}</div>
                  </div>
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-neutral-600 mb-1">Email</div>
                    <div className="text-sm text-black">{readResult.email}</div>
                  </div>
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-neutral-600 mb-1">Phone</div>
                    <div className="text-sm text-black">{readResult.phone}</div>
                  </div>
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-neutral-600 mb-1">KYC Status</div>
                    <div className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      readResult.kyc_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      readResult.kyc_status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {readResult.kyc_status.toUpperCase()}
                    </div>
                  </div>
                  {readResult.valid_from && readResult.valid_to && (
                    <div>
                      <div className="text-xs font-semibold text-neutral-600 mb-1">Valid Period</div>
                      <div className="text-xs text-black">{readResult.valid_from.split('T')[0]} → {readResult.valid_to.split('T')[0]}</div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={closeReadPopup}
                  className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            )}

            {readingStage === 'error' && (
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="bg-rose-100 rounded-full p-3">
                    <AlertCircle className="text-rose-600" size={32} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-rose-700">Read Failed</h2>
                <p className="text-neutral-600 mb-4">{readError || 'Unable to read the card'}</p>
                <button 
                  onClick={() => {
                    setReadingStage('placing')
                    setReadResult(null)
                    setReadError('')
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WRITE POPUP - Card Placement Animation */}
      {showWritePopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            {/* Close Button */}
            <button 
              onClick={closeWritePopup}
              className="absolute top-4 right-4 p-2 hover:bg-neutral-100 rounded-full transition-colors"
            >
              <X size={20} className="text-neutral-600" />
            </button>

            {writingStage === 'placing' && (
              <div className="text-center">
                <div className="mb-6 relative h-48 flex items-center justify-center">
                  {/* Sensor */}
                  <div className="absolute w-32 h-32 bg-gradient-to-br from-purple-200 to-purple-100 rounded-3xl border-3 border-purple-400 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-purple-300/20 to-transparent"></div>
                    <Zap className="text-purple-600 animate-pulse z-10" size={40} />
                  </div>
                  {/* Card - shows dropping animation */}
                  <div className="absolute w-28 h-40 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border-2 border-emerald-300 flex items-center justify-center animate-bounce" style={{animationDelay: '0.2s'}}>
                    <Wifi className="text-emerald-600" size={32} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Place Card on Sensor</h2>
                <p className="text-neutral-600">Position your RFID card over the reader</p>
              </div>
            )}

            {writingStage === 'writing' && (
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-32 h-40 mx-auto bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl flex items-center justify-center relative border-2 border-purple-300">
                    <div className="absolute inset-0 rounded-2xl animate-pulse bg-purple-200/20"></div>
                    <div className="absolute inset-2 rounded-xl border-2 border-purple-400/50 animate-[pulse_1s_ease-in-out_infinite]"></div>
                    <Loader2 className="text-purple-600 animate-spin z-10" size={32} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Writing Card</h2>
                <p className="text-neutral-600">UUID: {tagId.substring(0, 12)}...</p>
                <div className="text-sm text-neutral-500 animate-pulse mt-2">Keep card in place...</div>
              </div>
            )}

            {writingStage === 'success' && (
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="bg-emerald-100 rounded-full p-3">
                    <CheckCircle className="text-emerald-600" size={32} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Card Written Successfully</h2>
                <p className="text-neutral-600 mb-4">RFID tag is now bound to {selected?.name}</p>
                <div className="bg-neutral-50 rounded-lg p-3 text-left mb-4 text-xs">
                  <div className="font-mono text-neutral-700">{tagId}</div>
                </div>
                <button 
                  onClick={closeWritePopup}
                  className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors text-sm"
                >
                  Done
                </button>
              </div>
            )}

            {writingStage === 'error' && (
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="bg-rose-100 rounded-full p-3">
                    <AlertCircle className="text-rose-600" size={32} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-rose-700">Write Failed</h2>
                <p className="text-neutral-600 mb-4">{writeError || 'Unable to write to card'}</p>
                <button 
                  onClick={() => {
                    setWritingStage('placing')
                    setWriteError('')
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../src/lib/api'
import { Avatar } from '../../src/components/Avatar'
import { Shield, Cpu, Radio, BadgeCheck, AlertCircle, Loader2, ArrowLeft, Users as UsersIcon } from 'lucide-react'
import { useRouter } from 'next/router'

type VerifiedUser = { id: number; name: string; email: string; profile_photo_url?: string | null }

export default function AdminRFIDPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<VerifiedUser[]>([])
  const [selected, setSelected] = useState<VerifiedUser | null>(null)
  const [tagId, setTagId] = useState('')
  const [chainId, setChainId] = useState('')
  const [binding, setBinding] = useState(false)
  const [writeStage, setWriteStage] = useState<'idle'|'writing'|'success'|'error'>('idle')
  const [verifications, setVerifications] = useState<any[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  // Web Serial state
  const [serialSupported, setSerialSupported] = useState(false)
  const [serialConnected, setSerialConnected] = useState(false)
  const [serialStatus, setSerialStatus] = useState<string>('')
  const [serialNote, setSerialNote] = useState<string>('')
  const serialReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const serialPortRef = useRef<any>(null)
  const serialWriterRef = useRef<WritableStreamDefaultWriter<string> | null>(null)

  useEffect(() => {
    const uid = router.query.user_id
    if (uid && typeof uid === 'string') {
      // preselect user by id
      api(`/api/admin/users/verified?user_id=${uid}`).then(async r => {
        if (r.ok) {
          const data = await r.json()
          const item = (data.items || [])[0]
          if (item) setSelected(item)
        }
      })
    }
    const bc = router.query.blockchain_id
    if (typeof bc === 'string' && bc) setChainId(bc)
    const tag = router.query.tag_id
    if (typeof tag === 'string' && tag) setTagId(tag.toUpperCase())
  }, [router.query.user_id])

  // When a user is selected, try to prefill with their latest RFID binding
  useEffect(() => {
    const run = async () => {
      if (!selected) return
      // If query provided explicit values, respect them and don't override
      const queryChain = (typeof router.query.blockchain_id === 'string' && router.query.blockchain_id) ? String(router.query.blockchain_id) : ''
      const queryTag = (typeof router.query.tag_id === 'string' && router.query.tag_id) ? String(router.query.tag_id).toUpperCase() : ''
      try {
        // Always start clean for a new selection unless query prefilled
        if (!queryChain) setChainId('')
        if (!queryTag) setTagId('')

        // Prefill from latest binding first
        const r = await api(`/api/admin/rfid/bindings?user_id=${selected.id}`)
        if (r.ok) {
          const d = await r.json()
          const b = (d.items || [])[0]
          if (b) {
            if (!queryChain) setChainId(b.blockchain_id || '')
            if (!queryTag) setTagId((b.tag_id || '').toUpperCase())
          }
        }
        // If still no blockchain_id, fallback to latest Tourist ID's UUID
        const chainNow = queryChain || chainId
        if (!chainNow) {
          const t = await api(`/api/admin/tourist-ids?user_id=${selected.id}`)
          if (t.ok) {
            const td = await t.json()
            const latest = (td.items || [])[0]
            if (latest?.uuid && !queryChain) setChainId(latest.uuid)
          }
        }
      } catch {}
    }
    run()
  }, [selected?.id])

  const search = async (q: string) => {
    setQuery(q)
    const r = await api(`/api/admin/users/verified?q=${encodeURIComponent(q)}`)
    if (r.ok) {
      const data = await r.json()
      setUsers(data.items || [])
    }
  }

  const bind = async () => {
    if (!selected) { alert('Select a user first'); return }
    if (!tagId.trim()) { alert('Enter Tag ID (from RFID)'); return }
    setBinding(true)
    try {
      const res = await api('/api/admin/rfid/bind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: selected.id, tag_id: tagId.trim(), blockchain_id: chainId.trim() || undefined }) })
      if (res.ok) {
        // show small animation and indicate if Tourist ID was auto-created
        try {
          const d = await res.json()
          if (d?.tourist_created) {
            // Auto-prefill blockchain from returned tourist_id if empty
            if (!chainId && d.tourist_id) setChainId(d.tourist_id)
          }
        } catch {}
        setWriteStage('writing')
        setTimeout(()=>setWriteStage('success'), 900)
      } else {
        setWriteStage('error')
        alert('Bind failed')
      }
    } finally { setBinding(false); setTimeout(()=>setWriteStage('idle'), 1500) }
  }

  // Simulate device write UI animation only (actual writing occurs on device side)
  const doWriteAnimation = () => {
    setWriteStage('writing'); setTimeout(()=>setWriteStage('success'), 800)
    setTimeout(()=>setWriteStage('idle'), 1500)
  }

  useEffect(() => {
    // live verification feed
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
          // auto-fill Tag ID if empty
          setTagId(prev => prev && prev.length ? prev : (data.tag_id || ''))
        }
      } catch {}
    }
    return () => { ws.close() }
  }, [])

  // Detect Web Serial support
  useEffect(() => {
    try {
      const nav: any = navigator as any
      setSerialSupported(!!(nav && nav.serial))
    } catch {
      setSerialSupported(false)
    }
  }, [])

  const disconnectSerial = async () => {
    try {
      setSerialStatus('Disconnecting…')
      const writer = serialWriterRef.current
      if (writer) {
        try { await writer.close() } catch {}
        try { writer.releaseLock() } catch {}
      }
      const reader = serialReaderRef.current
      if (reader) {
        try { await reader.cancel() } catch {}
        try { reader.releaseLock() } catch {}
      }
      const port = serialPortRef.current
      if (port) {
        try { await port.close() } catch {}
      }
    } finally {
      serialReaderRef.current = null
      serialPortRef.current = null
      setSerialConnected(false)
      setSerialStatus('Disconnected')
    }
  }

  const connectSerial = async () => {
    try {
      const nav: any = navigator as any
      if (!nav.serial) { setSerialStatus('Web Serial not supported'); return }
      setSerialStatus('Requesting device…')
      // Optional: CH340 filter VID/PID (1A86:7523) - but keep open to others
      const filters = [ { usbVendorId: 0x1A86, usbProductId: 0x7523 } ]
      let port: any
      try {
        port = await nav.serial.requestPort({ filters })
      } catch (e) {
        // user cancelled or no device
        setSerialStatus('No device selected')
        return
      }
      setSerialStatus('Opening…')
      await port.open({ baudRate: 115200 })
      serialPortRef.current = port
      setSerialConnected(true)
      setSerialStatus('Connected')
  // Setup read pipeline
  const decoder = new TextDecoderStream()
  const reader = port.readable.pipeThrough(decoder).getReader()
      serialReaderRef.current = reader as any
  // Setup write pipeline
  const encoder = new TextEncoderStream()
  encoder.readable.pipeTo(port.writable)
  const writer = encoder.writable.getWriter()
  serialWriterRef.current = writer as any
      let buffer = ''
      const processLine = async (line: string) => {
        const s = line.trim()
        if (!s) return
        // TAG:UID
        const mTag = s.match(/^TAG:([0-9A-F]+)$/i)
        if (mTag) {
          const uid = mTag[1].toUpperCase()
          setTagId(uid)
          setSerialNote(`Scanned UID ${uid}`)
          try {
            const r = await api('/api/rfid/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag_id: uid }) })
            if (r.ok) {
              const data = await r.json()
              setVerifications(v => [{ tag_id: uid, ...data, ts: Date.now() }, ...v].slice(0,20))
            }
          } catch {}
          return
        }
        // READ:<payload>
        const mRead = s.match(/^READ:(.*)$/)
        if (mRead) {
          const payload = mRead[1]
          // Always reflect the read payload in the field for confirmation
          setChainId(payload)
          setSerialNote(`Read data: ${payload}`)
          return
        }
        if (s === 'WRITE_OK') { setSerialNote('Write successful'); return }
        if (s === 'WRITE_ERR') { setSerialNote('Write failed'); return }
        if (s.startsWith('ERR:')) { setSerialNote(s); return }
        if (s === 'OK') { return }
      }
      ;(async () => {
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            if (typeof value === 'string') {
              buffer += value
            } else if (value) {
              buffer += new TextDecoder().decode(value)
            }
            let idx: number
            while ((idx = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, idx)
              buffer = buffer.slice(idx + 1)
              await processLine(line)
            }
          }
        } catch (e) {
          setSerialStatus('Read error')
        } finally {
          await disconnectSerial()
        }
      })()
    } catch (e) {
      setSerialStatus('Connection failed')
      await disconnectSerial()
    }
  }

  const sendSerial = async (line: string) => {
    try {
      const w = serialWriterRef.current
      if (!serialConnected || !w) { setSerialStatus('Not connected'); return false }
      await w.write(line.endsWith('\n') ? line : (line + '\n'))
      return true
    } catch {
      setSerialStatus('Write failed')
      return false
    }
  }

  const scanUsb = async () => {
    setSerialStatus('Scanning…')
    await sendSerial('SCAN')
  }

  const writeUsb = async () => {
    if (!chainId.trim()) { alert('Enter Blockchain ID to write (will be truncated to 32 bytes)'); return }
    setSerialStatus('Writing…')
    await sendSerial(`WRITE:${chainId.trim()}`)
  }

  const readUsb = async () => {
    setSerialStatus('Reading…')
    await sendSerial('READ')
  }

  return (
    <div className="min-h-screen bg-white text-black px-3 sm:px-4 py-6">
      <Head><title>RFID - Admin</title></Head>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Radio className="text-neutral-700" size={20} /> RFID</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/users" className="underline text-sm inline-flex items-center gap-1"><UsersIcon className="text-neutral-700" size={16} /> Users</Link>
          <Link href="/admin/dashboard" className="underline text-sm inline-flex items-center gap-1"><Shield className="text-neutral-700" size={16} /> Dashboard</Link>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="p-4 border rounded-2xl border-neutral-200">
          <div className="text-sm font-medium mb-2">Bind RFID to Tourist</div>
          {serialSupported ? (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <button onClick={serialConnected ? disconnectSerial : connectSerial} className={`px-2 py-1 rounded border ${serialConnected? 'border-rose-300 text-rose-700':'border-neutral-300'}`}>{serialConnected? 'Disconnect Device':'Connect Device (USB)'}</button>
              <span className="text-neutral-600">{serialStatus}</span>
              {serialConnected && (
                <>
                  <button onClick={scanUsb} className="px-2 py-1 rounded border border-neutral-300">Scan UID (USB)</button>
                  <button onClick={writeUsb} className="px-2 py-1 rounded border border-neutral-300">Write Tag (USB)</button>
                  <button onClick={readUsb} className="px-2 py-1 rounded border border-neutral-300">Read Tag (USB)</button>
                  <button onClick={async()=>{
                    try {
                      let val = chainId.trim()
                      if (!val && selected) {
                        const t = await api(`/api/admin/tourist-ids?user_id=${selected.id}`)
                        if (t.ok) {
                          const td = await t.json()
                          const latest = (td.items || [])[0]
                          if (latest?.uuid) { val = latest.uuid; setChainId(latest.uuid) }
                        }
                      }
                      if (!val) { alert('No Tourist UUID available to write'); return }
                      setSerialStatus('Writing…')
                      await sendSerial(`WRITE:${val}`)
                    } catch {}
                  }} className="px-2 py-1 rounded border border-neutral-300">Write Tourist UUID (USB)</button>
                </>
              )}
            </div>
          ) : (
            <div className="mb-3 text-xs text-neutral-500">Web Serial not supported. Use Chrome/Edge on https:// or localhost.</div>
          )}
          <div className="grid gap-3">
            {serialNote && <div className="text-xs text-neutral-600">{serialNote}</div>}
            <div>
              <label className="text-xs text-neutral-600">Search verified user</label>
              <input value={query} onChange={e=>search(e.target.value)} placeholder="name / email / phone" className="mt-1 w-full px-3 py-2 rounded border border-neutral-300" />
            </div>
            <div className="max-h-40 overflow-auto rounded border border-neutral-200">
              {users.map(u => (
                <button key={u.id} onClick={()=>{
                  // On manual selection, reset fields to avoid leaking previous user's values
                  const hasQueryChain = typeof router.query.blockchain_id === 'string' && router.query.blockchain_id
                  const hasQueryTag = typeof router.query.tag_id === 'string' && router.query.tag_id
                  if (!hasQueryChain) setChainId('')
                  if (!hasQueryTag) setTagId('')
                  setSelected(u)
                }} className={`w-full text-left px-3 py-2 border-b last:border-b-0 ${selected?.id===u.id? 'bg-emerald-50':''}`}>
                  <div className="flex items-center gap-2">
                    <Avatar src={u.profile_photo_url ? `/api/proxy${u.profile_photo_url}` : undefined} alt={u.name} size={24} className="w-6 h-6" />
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-neutral-500">{u.email}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {selected && (
              <div className="p-3 rounded border border-neutral-200 bg-white">
                <div className="text-sm">Selected: <span className="font-medium">{selected.name}</span></div>
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs text-neutral-600">RFID Tag ID</label>
                    <input value={tagId} onChange={e=>setTagId(e.target.value.toUpperCase())} placeholder="e.g. A1B2C3D4" className="mt-1 w-full px-3 py-2 rounded border border-neutral-300 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-600">Blockchain ID (optional)</label>
                    <input value={chainId} onChange={e=>setChainId(e.target.value)} placeholder="0x.. or tx hash" className="mt-1 w-full px-3 py-2 rounded border border-neutral-300" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={bind} disabled={binding} className="px-3 py-1.5 rounded bg-black text-white inline-flex items-center gap-2">{binding ? (<><Loader2 size={16} className="animate-spin"/> Binding…</>) : 'Bind tag'}</button>
                  <button onClick={doWriteAnimation} className="px-3 py-1.5 rounded border border-neutral-300 inline-flex items-center gap-2"><Cpu size={16}/> Simulate write</button>
                </div>
                <div className="h-10 mt-3">
                  {writeStage==='writing' && <div className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin"/> Writing in progress…</div>}
                  {writeStage==='success' && <div className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 inline-flex items-center gap-2"><BadgeCheck size={16}/> Success</div>}
                  {writeStage==='error' && <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 inline-flex items-center gap-2"><AlertCircle size={16}/> Failed</div>}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="p-4 border rounded-2xl border-neutral-200">
          <div className="text-sm font-medium mb-2">Live Verification</div>
          <div className="text-xs text-neutral-600 mb-2">When a tourist taps their card at a checkpoint, you’ll see the result below with animations.</div>
          <div className="grid gap-2">
            {verifications.map(v => (
              <div key={v.ts+v.tag_id} className={`p-3 rounded-xl border ${v.valid? 'border-emerald-300 bg-emerald-50':'border-rose-300 bg-rose-50'} animate-[pulse_0.6s_ease-out_1]`}>
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs">{v.tag_id}</div>
                  <div className={`px-2 py-0.5 rounded text-xs ${v.valid? 'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{v.valid? 'VALID':'INVALID'}</div>
                </div>
                <div className="text-sm mt-1">{v.name_masked || 'Unknown'} {v.tourist_id ? (<span className="ml-2 font-mono text-xs">{String(v.tourist_id).slice(0,8)}…</span>) : null}</div>
                {v.valid_from && v.valid_to && (
                  <div className="text-xs text-neutral-600">{v.valid_from.replace('T',' ').replace('Z','')} → {v.valid_to.replace('T',' ').replace('Z','')}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

import type { AppProps } from 'next/app'
import '../styles/globals.css'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { I18nProvider } from '../src/i18n/I18nProvider'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Register service worker for PWA/offline caching
    if ('serviceWorker' in navigator) {
      try { navigator.serviceWorker.register('/sw.js') } catch {}
    }
    // Helper for safe notification permission request (supports old callback-only browsers)
    const safeRequestNotificationPermission = () => {
      try {
        const req: any = (window as any).Notification && (window as any).Notification.requestPermission
        if (!req) return
        const result = req.call((window as any).Notification)
        if (result && typeof result.then === 'function') {
          result.catch(() => {})
        }
      } catch {}
    }
    // Global WebSocket listener for admin broadcast notices
    let ws: WebSocket | null = null
    try {
      const loc = typeof window !== 'undefined' ? window.location : null
      if (loc) {
        const wsProto = loc.protocol === 'https:' ? 'wss' : 'ws'
        ws = new WebSocket(`${wsProto}://${loc.host.replace(':3000', ':8001')}/ws/alerts`)
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data)
            if (msg.event === 'notice' && msg.data?.message) {
              if (typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'default') safeRequestNotificationPermission()
                if (Notification.permission === 'granted') {
                  try { new Notification('Zentora', { body: msg.data.message }) } catch {}
                } else {
                  // Fallback to in-page alert if notifications are not permitted
                  try { alert(String(msg.data.message)) } catch {}
                }
              } else {
                // Environments without Notification API
                try { alert(String(msg.data.message)) } catch {}
              }
            }
          } catch {}
        }
      }
    } catch {}
    return () => { if (ws) try { ws.close() } catch {} }
  }, [])
  return (
    <I18nProvider>
      <Component {...pageProps} />
    </I18nProvider>
  )
}

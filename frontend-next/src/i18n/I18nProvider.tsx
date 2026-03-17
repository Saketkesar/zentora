import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import en from '../../locales/en.json'
import hi from '../../locales/hi.json'

type I18nCtx = {
  t: (k: keyof typeof en) => string
  lang: 'en'|'hi'
  setLang: (l: 'en'|'hi') => void
}

const Ctx = createContext<I18nCtx | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<'en'|'hi'>(typeof window === 'undefined' ? 'en' : ((localStorage.getItem('lang') as 'en'|'hi') || 'en'))
  useEffect(() => { localStorage.setItem('lang', lang) }, [lang])
  const dict = useMemo(() => (lang === 'en' ? en : hi), [lang])
  const setLang = (l: 'en'|'hi') => setLangState(l)

  const t = (k: keyof typeof en) => (dict as any)[k] || (en as any)[k] || String(k)

  return <Ctx.Provider value={{ t, lang, setLang }}>{children}</Ctx.Provider>
}

export function useI18n() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

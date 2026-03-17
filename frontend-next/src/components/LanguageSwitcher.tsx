import { useI18n } from '../i18n/useI18n'

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n()
  return (
    <select
      value={lang}
      onChange={(e)=> setLang(e.target.value as 'en' | 'hi')}
      className="border rounded px-2 py-1 bg-transparent"
      aria-label="Language selector"
    >
      <option value="en">English</option>
      <option value="hi">हिन्दी</option>
    </select>
  )
}

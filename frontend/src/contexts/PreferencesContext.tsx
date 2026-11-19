import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken } from '../lib/api'

export type Language = 'id' | 'en'
export type DateFormat = 'long' | 'numeric' | 'iso'
export type Timezone = 'wib' | 'wita' | 'wit'
export type Density = 'comfortable' | 'compact' | 'spacious'

export interface Preferences {
  language: Language
  dateFormat: DateFormat
  timezone: Timezone
  density: Density
  reduceMotion: boolean
  sidebarDefault: boolean
  startPage: string
}

export const DEFAULT_PREFERENCES: Preferences = {
  language: 'id',
  dateFormat: 'long',
  timezone: 'wib',
  density: 'comfortable',
  reduceMotion: false,
  sidebarDefault: false,
  startPage: '/',
}

const STORAGE_KEY = 'wpc.preferences.v2'

const locales: Record<Language, string> = { id: 'id-ID', en: 'en-GB' }
const timezones: Record<Timezone, string> = {
  wib: 'Asia/Jakarta',
  wita: 'Asia/Makassar',
  wit: 'Asia/Jayapura',
}

function readCache(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

interface PreferencesContextValue {
  preferences: Preferences
  language: Language
  locale: string
  setPreferences: (next: Preferences) => Promise<Preferences>
  t: (id: string, en: string) => string
  formatDate: (value: string | number | Date | null | undefined, withTime?: boolean) => string
  formatTime: (value: string | number | Date | null | undefined) => string
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<Preferences>(readCache)

  useEffect(() => {
    if (!getToken()) return
    let active = true
    api
      .get<Preferences>('/auth/preferences')
      .then((remote) => {
        if (!active) return
        const next = { ...DEFAULT_PREFERENCES, ...remote }
        setPreferencesState(next)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.lang = preferences.language
    root.dataset.density = preferences.density
    root.dataset.reduceMotion = preferences.reduceMotion ? 'true' : 'false'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  const setPreferences = useCallback(async (next: Preferences) => {
    if (!getToken()) {
      setPreferencesState(next)
      return next
    }
    const saved = await api.put<Preferences>('/auth/preferences', next)
    setPreferencesState(saved)
    return saved
  }, [])

  const value = useMemo<PreferencesContextValue>(() => {
    const locale = locales[preferences.language]
    const timeZone = timezones[preferences.timezone]

    const formatDate = (input: string | number | Date | null | undefined, withTime = false) => {
      if (input === null || input === undefined || input === '') return '—'
      const date = input instanceof Date ? input : new Date(input)
      if (Number.isNaN(date.getTime())) return '—'
      const base: Intl.DateTimeFormatOptions =
        preferences.dateFormat === 'iso'
          ? { year: 'numeric', month: '2-digit', day: '2-digit' }
          : preferences.dateFormat === 'numeric'
            ? { year: 'numeric', month: '2-digit', day: '2-digit' }
            : { year: 'numeric', month: 'long', day: '2-digit' }
      const options: Intl.DateTimeFormatOptions = withTime
        ? { ...base, hour: '2-digit', minute: '2-digit' }
        : base
      return new Intl.DateTimeFormat(
        preferences.dateFormat === 'iso' ? 'en-CA' : locale,
        { ...options, timeZone },
      ).format(date)
    }

    const formatTime = (input: string | number | Date | null | undefined) => {
      if (input === null || input === undefined || input === '') return '—'
      const date = input instanceof Date ? input : new Date(input)
      if (Number.isNaN(date.getTime())) return '—'
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      }).format(date)
    }

    return {
      preferences,
      language: preferences.language,
      locale,
      setPreferences,
      t: (id, en) => (preferences.language === 'en' ? en : id),
      formatDate,
      formatTime,
    }
  }, [preferences, setPreferences])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider')
  return context
}

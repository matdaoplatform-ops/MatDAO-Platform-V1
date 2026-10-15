"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { en, type Dict } from "@/content/en"
import { th } from "@/content/th"

export type Locale = "en" | "th"
const DICTS: Record<Locale, Dict> = { en, th }
const KEY = "matdao.locale"

interface I18n {
  locale: Locale
  t: Dict
  setLocale: (l: Locale) => void
}

const Ctx = createContext<I18n>({ locale: "en", t: en, setLocale: () => {} })

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = new URLSearchParams(window.location.search).get("lang") || window.localStorage.getItem(KEY)
    } catch {
      /* storage blocked: stay on English */
    }
    if (saved === "th" || saved === "en") setLocaleState(saved)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      window.localStorage.setItem(KEY, l)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(() => ({ locale, t: DICTS[locale], setLocale }), [locale, setLocale])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  return useContext(Ctx)
}

"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, getLang, LANG_STORAGE_KEY, type Lang, type Translation } from "@/lib/i18n";

interface LangContextValue {
  lang: Lang;
  t: Translation;
  switchLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "pt-BR",
  t: translations["pt-BR"],
  switchLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Start with pt-BR so server and client render the same initial HTML (no hydration mismatch).
  // After mount, read localStorage and update if the user has a different preference saved.
  const [lang, setLang] = useState<Lang>("pt-BR");

  useEffect(() => {
    const stored = getLang();
    if (stored !== "pt-BR") setLang(stored);
  }, []);

  function switchLang(l: Lang) {
    localStorage.setItem(LANG_STORAGE_KEY, l);
    setLang(l);
  }

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], switchLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

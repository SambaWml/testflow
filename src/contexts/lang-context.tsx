"use client";

import React, { createContext, useContext, useState } from "react";
import { translations, getLang, setLangAndReload, type Lang, type Translation } from "@/lib/i18n";

interface LangContextValue {
  lang: Lang;
  t: Translation;
  switchLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "en-US",
  t: translations["en-US"],
  switchLang: setLangAndReload,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang] = useState<Lang>(() => getLang());

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], switchLang: setLangAndReload }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

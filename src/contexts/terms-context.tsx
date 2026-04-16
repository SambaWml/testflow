"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  getTerms,
  saveTerms as _saveTerms,
  resetTerms as _resetTerms,
  DEFAULT_TERMS,
  type Terms,
} from "@/lib/term-config";
import { useLang } from "./lang-context";

interface TermsContextValue {
  terms: Terms;
  saveTerms: (next: Terms) => void;
  resetTerms: () => void;
}

const TermsContext = createContext<TermsContextValue>({
  terms: DEFAULT_TERMS,
  saveTerms: () => {},
  resetTerms: () => {},
});

export function TermsProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  const [terms, setTerms] = useState<Terms>(DEFAULT_TERMS);

  // Reload terms whenever language changes
  useEffect(() => {
    setTerms(getTerms(lang));
  }, [lang]);

  function saveTerms(next: Terms) {
    _saveTerms(next, lang);
    setTerms({ ...next });
  }

  function resetTerms() {
    _resetTerms(lang);
    setTerms(getTerms(lang));
  }

  return (
    <TermsContext.Provider value={{ terms, saveTerms, resetTerms }}>
      {children}
    </TermsContext.Provider>
  );
}

export function useTerms() {
  return useContext(TermsContext);
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { readLanguage, saveLanguage, translate, type Language } from "@/lib/language";

const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void; t: (label: string) => string } | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  useEffect(() => {
    const stored = readLanguage(localStorage);
    document.documentElement.lang = stored;
    queueMicrotask(() => setLanguageState(stored));
  }, []);
  const setLanguage = (value: Language) => {
    saveLanguage(localStorage, value);
    document.documentElement.lang = value;
    setLanguageState(value);
  };
  return <LanguageContext.Provider value={{ language, setLanguage, t: (label) => translate(language, label) }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is required");
  return value;
}

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  return <select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}
    className="rounded-md border border-border bg-background px-2 py-1 text-sm">
    <option value="en">English</option><option value="si">සිංහල</option><option value="ta">தமிழ்</option>
  </select>;
}

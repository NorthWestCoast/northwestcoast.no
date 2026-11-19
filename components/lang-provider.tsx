'use client';

import { createContext, useContext } from 'react';
import { getDict, type Lang } from '@/lib/i18n';
import type { Dict } from '@/lib/dictionaries/no';

const LangContext = createContext<Lang>('no');

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

/** Ordbok for gjeldende språk i klientkomponenter. */
export function useT(): Dict {
  return getDict(useContext(LangContext));
}

import { useEffect, useState } from 'react';

// Language lived inside the landing page's copy.ts, which was fine while the landing page was
// the only bilingual surface. The app is bilingual too now, so the state moved here and copy.ts
// re-exports it — one toggle, one storage key, landing and app always agree.
//
// Still no i18n framework (spec §10). With exactly two languages and no outside translators, a
// key/dictionary layer buys nothing but a second file to keep in sync: `t('Simpan', 'Save')`
// keeps both strings at the call site, so a missing translation is a type error, not a runtime
// fallback to a key name. The landing page keeps its bulk COPY object — that's prose, not labels.

export type Lang = 'ms' | 'en';

const KEY = 'lang';
const listeners = new Set<(l: Lang) => void>();

export const getLang = (): Lang =>
  // `landing_lang` is the pre-split key; read it once so an existing choice survives the move.
  (localStorage.getItem(KEY) ?? localStorage.getItem('landing_lang')) === 'en' ? 'en' : 'ms';

export function setLang(next: Lang) {
  localStorage.setItem(KEY, next);
  document.documentElement.lang = next;
  for (const fn of listeners) fn(next);
}

/** The current language. Re-renders every consumer when it changes. */
export function useLang(): Lang {
  const [lang, setLocal] = useState<Lang>(getLang);
  useEffect(() => {
    listeners.add(setLocal);
    return () => { listeners.delete(setLocal); };
  }, []);
  return lang;
}

/**
 * Picks between a Malay and an English value. Works for anything, not just strings, so a
 * bilingual array or option list can be written the same way as a label.
 */
export function useT() {
  const lang = useLang();
  return <T,>(ms: T, en: T): T => (lang === 'en' ? en : ms);
}

/** Non-reactive form, for module-level helpers and event handlers outside a component. */
export const t = <T,>(ms: T, en: T): T => (getLang() === 'en' ? en : ms);

/**
 * BCP-47 tag for `toLocaleDateString` and friends. Both stay on Malaysia — the audience is the
 * same either way, so only the month and weekday names change, not the date order or currency.
 */
export const locale = () => (getLang() === 'en' ? 'en-MY' : 'ms-MY');

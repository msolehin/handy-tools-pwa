import { useEffect, useState } from 'react';

// Theme lived inside Layout, which the landing page deliberately renders outside of. Rather
// than a second copy of the same localStorage-plus-class dance, both use this.
// main.tsx applies the saved class before first paint; this owns every change after that.

type Theme = 'light' | 'dark';

const listeners = new Set<(t: Theme) => void>();

export const getTheme = (): Theme =>
  document.documentElement.classList.contains('light') ? 'light' : 'dark';

export function setTheme(next: Theme) {
  document.documentElement.classList.toggle('light', next === 'light');
  localStorage.setItem('theme', next);
  for (const fn of listeners) fn(next);
}

export const toggleTheme = () => setTheme(getTheme() === 'light' ? 'dark' : 'light');

/** Returns whether light mode is on, and a toggle. Stays in sync across every consumer. */
export function useTheme(): [boolean, () => void] {
  const [theme, setLocal] = useState<Theme>(getTheme);
  useEffect(() => {
    listeners.add(setLocal);
    return () => { listeners.delete(setLocal); };
  }, []);
  return [theme === 'light', toggleTheme];
}

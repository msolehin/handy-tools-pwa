import React from 'react';
import { Languages, MoonStar, SunMedium } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { getLang, setLang, useLang, useT } from '../lib/lang';

/** One segmented control. Two options is all either preference ever has. */
function Segmented<T extends string>({ label, Icon, value, options, onPick }: {
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  value: T;
  options: { value: T; label: string; Icon?: React.ComponentType<{ size?: number }> }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="flex items-center gap-2.5 text-sm font-medium text-text">
        <span className="text-muted"><Icon size={18} /></span>
        {label}
      </span>
      <div role="group" aria-label={label} className="flex shrink-0 gap-0.5 rounded-xl bg-text/5 p-0.5">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              onClick={() => onPick(o.value)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-bold transition-colors ${
                on ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              {o.Icon && <o.Icon size={14} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Appearance and language, in the settings sheet directly under the account block. */
const Preferences: React.FC = () => {
  const [isLight, toggleTheme] = useTheme();
  const lang = useLang();
  const t = useT();

  return (
    <div className="rounded-2xl bg-surface border border-text/5 divide-y divide-text/5">
      <Segmented
        label={t('Paparan', 'Appearance')}
        Icon={isLight ? SunMedium : MoonStar}
        value={isLight ? 'light' : 'dark'}
        options={[
          { value: 'light', label: t('Cerah', 'Light'), Icon: SunMedium },
          { value: 'dark', label: t('Gelap', 'Dark'), Icon: MoonStar },
        ]}
        // useTheme only exposes a toggle, which is all this needs: picking the side already
        // showing is a no-op, so nothing has to reach past it to set an absolute value.
        onPick={(v) => { if ((v === 'light') !== isLight) toggleTheme(); }}
      />
      <Segmented
        label={t('Bahasa', 'Language')}
        Icon={Languages}
        value={lang}
        options={[
          { value: 'ms', label: 'MS' },
          { value: 'en', label: 'EN' },
        ]}
        onPick={(v) => { if (v !== getLang()) setLang(v); }}
      />
    </div>
  );
};

export default Preferences;

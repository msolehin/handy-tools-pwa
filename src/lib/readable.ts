// Turning a stored value into something a person can read off a screen at a glance.
import { daysUntil } from './horizon.ts';
import { t } from './lang.ts';

/**
 * Long numbers are read four digits at a time — the way they are printed on a card or a bill.
 * Anything holding letters or punctuation was already formatted by whoever issued it; leave it be.
 */
export const groupDigits = (v: string) =>
  /^\d{7,}$/.test(v) ? v.replace(/(\d{4})(?=\d)/g, '$1 ') : v;

/**
 * The last four stay readable, the way a statement prints it, so a hidden number can still be told
 * apart from the one below it. The run of dots is capped — past a dozen it stops meaning anything
 * and only pushes the digits that matter out of the card.
 */
export const maskDigits = (v: string) =>
  v.length <= 4 ? '••••' : `${'•'.repeat(Math.min(v.length - 4, 12))} ${v.slice(-4)}`;

/** Days only read as days for a month or so. Past that, say it the way a person would. */
export const relativeDay = (iso: string, now = new Date()) => {
  const days = daysUntil(iso, now);
  const n = Math.abs(days);
  const span = n < 31 ? t(`${n} hari`, `${n} day${n === 1 ? '' : 's'}`)
    : n < 365 ? t(`${Math.round(n / 30)} bulan`, `${Math.round(n / 30)} month${Math.round(n / 30) === 1 ? '' : 's'}`)
      : t(`${(n / 365).toFixed(n < 730 ? 1 : 0)} tahun`, `${(n / 365).toFixed(n < 730 ? 1 : 0)} years`);
  if (days === 0) return t('Hari ini', 'Today');
  return days > 0 ? t(`${span} lagi`, `in ${span}`) : t(`${span} lalu`, `${span} ago`);
};

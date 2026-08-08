// Phone numbers get typed every which way: 012-345 6789, +6012 3456789, 60123456789, 0123456789.
// A wa.me link only accepts digits with a country code and no plus sign, so every number the app
// wants to open in WhatsApp funnels through here rather than being patched up at each call site.

/**
 * `raw` as digits with a country code, ready for `https://wa.me/<n>`. Null when it cannot be one,
 * which is also what the form uses to tell the user the number won't work.
 *
 * A leading 0 is Malaysian local notation and becomes 60. Anything already starting with a country
 * code is left alone — a landlord with a Singapore or Indonesian number still has to be reachable.
 */
export function waNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  const intl = digits.startsWith('60') ? digits
    : digits.startsWith('0') ? `60${digits.slice(1)}`
      : digits;

  // 60 + 9 digits is the shortest real Malaysian mobile (01x-xxx xxxx); E.164 caps the whole
  // number at 15. Outside that range it is a typo, not a number we should hand to WhatsApp.
  return intl.length >= 10 && intl.length <= 15 ? intl : null;
}

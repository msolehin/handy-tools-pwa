import type { Lang } from './lang';

// Asking for money back is the part people put off, so the tracker writes the message for them.
// Five tones because the right one depends entirely on who owes you: a sibling, a colleague and a
// contractor each need a different opening, and picking from a list is faster than drafting.
//
// Amount arrives pre-formatted — the caller already renders it as RM elsewhere, and one formatter
// beats two that can drift apart.

export type Tone = 'gentle' | 'friendly' | 'playful' | 'direct' | 'formal';

export const TONES: { key: Tone; ms: string; en: string }[] = [
  { key: 'gentle', ms: 'Lembut', en: 'Gentle' },
  { key: 'friendly', ms: 'Mesra', en: 'Friendly' },
  { key: 'playful', ms: 'Gurau', en: 'Playful' },
  { key: 'direct', ms: 'Terus', en: 'Direct' },
  { key: 'formal', ms: 'Formal', en: 'Formal' },
];

/** A reminder for someone who owes you `amount`. `desc` is optional and folded in where it fits. */
export function nudge(tone: Tone, lang: Lang, name: string, amount: string, desc: string): string {
  const who = name.trim() || (lang === 'en' ? 'there' : 'you');
  const what = desc.trim();
  const ms = lang === 'ms';

  // Each tone phrases the "what for" clause its own way, so it is built per-branch rather than
  // appended — a formal letter and a joke cannot share the same parenthetical.
  switch (tone) {
    case 'gentle':
      return ms
        ? `Hi ${who}, sori ganggu. Nak ingatkan pasal ${amount}${what ? ` untuk ${what}` : ''} tu. Bila-bila you senang settle pun takpe 🙏`
        : `Hi ${who}, sorry to bother you. Just a small reminder about the ${amount}${what ? ` for ${what}` : ''}. Whenever you're free to settle it is fine 🙏`;
    case 'friendly':
      return ms
        ? `Hai ${who}! 😊 Yang ${amount}${what ? ` (${what})` : ''} hari tu — boleh transfer bila you free? Terima kasih!`
        : `Hi ${who}! 😊 About the ${amount}${what ? ` (${what})` : ''} from the other day — could you transfer it over when you get a chance? Thank you!`;
    case 'playful':
      return ms
        ? `${who}... ${amount}${what ? ` (${what})` : ''} tu dah mula rindu dompet dia 🥲 Bila nak hantar balik?`
        : `${who}... that ${amount}${what ? ` (${what})` : ''} is starting to miss its wallet 🥲 Any chance of a reunion soon?`;
    case 'direct':
      return ms
        ? `Hi ${who}, boleh settle ${amount}${what ? ` untuk ${what}` : ''}? Transfer je bila-bila hari ni. Terima kasih.`
        : `Hi ${who}, could you settle the ${amount}${what ? ` for ${what}` : ''}? A transfer any time today works. Thanks.`;
    case 'formal':
      return ms
        ? `Salam ${who}, saya ingin membuat susulan berkenaan baki ${amount}${what ? ` bagi ${what}` : ''} yang masih belum dijelaskan. Mohon maklumkan tarikh pembayaran yang sesuai. Terima kasih.`
        : `Hi ${who}, I'm following up on the outstanding ${amount}${what ? ` for ${what}` : ''}. Could you let me know a suitable date for payment? Thank you.`;
  }
}

import React, { useEffect, useState } from 'react';
import { Shield, ShieldCheck } from 'lucide-react';
import { getUser, subscribe, type User } from '../lib/auth';
import { useT } from '../lib/lang';

// Never-synced tools, named explicitly because "some things stay local" is the kind of claim
// people are right not to believe without specifics. The tool names themselves don't translate.
const LOCAL_ONLY_MS = 'IC Palang, PDF Editor, Lupa parking? dan kalkulator-kalkulator';
const LOCAL_ONLY_EN = 'IC Palang, PDF Editor, Lupa parking? and the calculators';

/**
 * The privacy card on Home. It has to tell the truth in both states — the old copy said
 * "no data is ever sent to a server", which stopped being true the day accounts shipped.
 */
const PrivacyNote: React.FC = () => {
  const [user, setUser] = useState<User | null>(getUser());
  useEffect(() => subscribe(setUser), []);
  const t = useT();

  const Icon = user ? ShieldCheck : Shield;
  const localOnly = t(LOCAL_ONLY_MS, LOCAL_ONLY_EN);

  return (
    <div className="mt-8 p-5 bg-primary/5 border border-primary/10 rounded-2xl">
      <div className="flex items-start space-x-4">
        <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
          <Icon className="text-primary" size={24} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text/90 mb-1.5">
            {user
              ? t('Disimpan ke akaun anda', 'Saved to your account')
              : t('Peribadi secara lalai', 'Private by default')}
          </h4>
          <p className="text-xs text-muted leading-relaxed">
            {user
              ? t(
                  `Rekod anda disimpan ke akaun Google anda, jadi anda boleh mencapainya dari mana-mana peranti — termasuk nombor akaun dan ID yang anda simpan dalam Important Number / Date. ${localOnly} tidak memuat naik apa-apa: semuanya berjalan pada peranti ini sahaja. Semuanya tetap berfungsi tanpa internet; perubahan disegerakkan bila anda kembali dalam talian.`,
                  `Your records are saved to your Google account, so you can reach them from any device — including the account and ID numbers you keep in Important Number / Date. ${localOnly} never upload anything: they run entirely on this device. Everything keeps working offline; changes sync when you're back online.`,
                )
              : t(
                  `Tiada akaun diperlukan — setiap alat berfungsi sekarang, dan tiada apa yang anda masukkan keluar dari peranti ini. Rekod baharu disimpan untuk sesi pelayar ini sahaja, jadi ia hilang bila anda tutup tab. Log masuk dengan Google untuk menyimpan rekod anda dan mencapainya dari peranti lain. ${localOnly} kekal pada peranti anda dalam kedua-dua keadaan.`,
                  `No account needed — every tool works right now, and nothing you enter leaves this device. New entries are kept for this browser session only, so they're gone once you close the tab. Sign in with Google to keep your records and reach them from your other devices. ${localOnly} stay on your device either way.`,
                )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyNote;

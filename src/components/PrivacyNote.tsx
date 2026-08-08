import React, { useEffect, useState } from 'react';
import { Shield, ShieldCheck } from 'lucide-react';
import { getUser, subscribe, type User } from '../lib/auth';

// Never-synced tools, named explicitly because "some things stay local" is the kind of claim
// people are right not to believe without specifics.
const LOCAL_ONLY = 'IC Palang, PDF Editor, Lupa parking? and the calculators';

/**
 * The privacy card on Home. It has to tell the truth in both states — the old copy said
 * "no data is ever sent to a server", which stopped being true the day accounts shipped.
 */
const PrivacyNote: React.FC = () => {
  const [user, setUser] = useState<User | null>(getUser());
  useEffect(() => subscribe(setUser), []);

  const Icon = user ? ShieldCheck : Shield;

  return (
    <div className="mt-8 p-5 bg-primary/5 border border-primary/10 rounded-2xl">
      <div className="flex items-start space-x-4">
        <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
          <Icon className="text-primary" size={24} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text/90 mb-1.5">
            {user ? 'Saved to your account' : 'Private by default'}
          </h4>
          <p className="text-xs text-muted leading-relaxed">
            {user ? (
              <>
                Your records are saved to your Google account, so you can reach them from any
                device — including the account and ID numbers you keep in Important Number / Date.
                {' '}{LOCAL_ONLY} never upload anything: they run entirely on this device.
                Everything keeps working offline; changes sync when you're back online.
              </>
            ) : (
              <>
                No account needed — every tool works right now, and nothing you enter leaves
                this device. New entries are kept for this browser session only, so they're
                gone once you close the tab. Sign in with Google to keep your records and
                reach them from your other devices. {LOCAL_ONLY} stay on your device either way.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyNote;

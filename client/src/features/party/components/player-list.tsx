import { CrownIcon } from 'lucide-react';

import type { PartyPlayer } from '@/bridge/party';
import { partyTone } from '@/features/party/lib/party-tones';
import { t } from '@/i18n';
import { cn } from '@/shared/utils/cn';

/** Players as colour plates; the phone's own player is outlined in white. */
export const PlayerList = ({ players, meId }: { players: PartyPlayer[]; meId?: string }) => (
  <ul className="grid grid-cols-2 gap-3">
    {players.map((player, index) => {
      const tone = partyTone(player.color, index);
      const me = player.id === meId;
      return (
        <li
          key={player.id}
          className={cn(
            'flex min-w-0 items-center gap-1.5 rounded-xl px-3 py-2 font-party font-black shadow-[0_4px_0_rgb(0_0_0/0.45)]',
            tone.fill,
            tone.ink,
            me && 'ring-4 ring-white',
          )}
        >
          {player.master && (
            <CrownIcon className="size-4 shrink-0" aria-label={t('party.players.master')} />
          )}
          <span className="truncate">{player.name}</span>
          {me && (
            <span className="ml-auto shrink-0 text-xs opacity-80">{t('party.players.you')}</span>
          )}
        </li>
      );
    })}
  </ul>
);

import type { PartyPlayer } from '@/bridge/party';
import { partyTone } from '@/features/party/lib/party-tones';
import { t } from '@/i18n';
import { cn } from '@/shared/utils/cn';

const Pedestal = ({ empty = false }: { empty?: boolean }) => (
  <div
    aria-hidden="true"
    className={cn(
      'h-10 w-[86%] rounded-b-lg bg-linear-to-b sm:h-16',
      empty ? 'from-[#22222F] to-[#16161F]' : 'from-muted to-[#1A1A26]',
    )}
  />
);

/** A contestant desk on the TV stage: the name on a plate of the player's colour. */
export const PlayerDesk = ({ player, index }: { player: PartyPlayer; index: number }) => {
  const tone = partyTone(player.color, index);
  return (
    <div className="flex min-w-0 flex-col items-center">
      <span
        className={cn(
          'mb-2 rounded-full bg-yellow-400 px-3 py-1 text-xs font-extrabold uppercase text-yellow-950',
          !player.master && 'invisible',
        )}
      >
        {t('party.players.master')}
      </span>
      <div
        className={cn(
          'w-full truncate rounded-t-2xl rounded-b-md px-3 py-3 text-center font-party text-2xl font-black sm:text-4xl',
          tone.fill,
          tone.shadow,
          tone.ink,
        )}
      >
        {player.name}
      </div>
      <Pedestal />
    </div>
  );
};

/** An empty seat waiting for a phone to join. */
export const FreeSeat = () => (
  <div className="flex min-w-0 flex-col items-center">
    <span className="invisible mb-2 px-3 py-1 text-xs">-</span>
    <div className="w-full truncate rounded-t-2xl rounded-b-md border-4 border-dashed border-emerald-500 px-3 py-2 text-center font-party text-xl font-extrabold text-emerald-300 sm:text-2xl">
      {t('party.host.freeSeat')}
    </div>
    <Pedestal empty />
  </div>
);

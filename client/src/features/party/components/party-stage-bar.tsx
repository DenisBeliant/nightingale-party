import { partyTone } from '@/features/party/lib/party-tones';
import { usePlaybackMicState } from '@/features/playback/providers';
import type { PlaybackPlayerMicState } from '@/features/playback/providers/playback-mic-context';
import { playerDisplayName } from '@/features/playback/utils/player-display-name';
import { t } from '@/i18n';
import { cn } from '@/shared/utils/cn';

import { ScoreGauge } from './score-gauge';

const GAUGES = [
  ['pitch', 'party.gauges.pitch'],
  ['rhythm', 'party.gauges.rhythm'],
  ['lyrics', 'party.gauges.lyrics'],
] as const;

/** One singer as a game show contestant desk: name, score plate, three gauges. */
const Desk = ({
  player,
  players,
  index,
}: {
  player: PlaybackPlayerMicState;
  players: PlaybackPlayerMicState[];
  index: number;
}) => {
  const tone = partyTone(player.color, index);
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-2xl border-t-8 bg-card/95 px-4 py-3',
        tone.border,
        tone.shadow,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-party text-lg font-black md:text-2xl">
          {playerDisplayName(player, players)}
        </span>
        <span className="rounded-lg bg-black px-3 py-0.5 font-party text-lg font-black text-yellow-400 tabular-nums md:text-2xl">
          {player.pitchScore ?? '--'}
        </span>
      </div>
      {GAUGES.map(([key, label]) => (
        <ScoreGauge
          key={key}
          label={t(label)}
          value={player.gauges[key]}
          tone={tone}
          showValue={false}
        />
      ))}
    </div>
  );
};

/**
 * Contestant desks of a party round along the bottom of the playback screen,
 * over a darker stage tint that keeps the lyrics card readable.
 */
export const PartyStageBar = () => {
  const { players } = usePlaybackMicState();
  const singers = players.filter((player) => player.party);
  if (singers.length === 0) {
    return null;
  }
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5] bg-linear-to-b from-[#14142A]/60 via-transparent to-[#0D0D16]/90"
      />
      <div
        className="dark pointer-events-none absolute inset-x-0 bottom-0 z-20 grid justify-center gap-4 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-foreground md:gap-6"
        style={{ gridTemplateColumns: `repeat(${singers.length}, minmax(0, 20rem))` }}
      >
        {singers.map((player, index) => (
          <Desk key={player.id} player={player} players={singers} index={index} />
        ))}
      </div>
    </>
  );
};

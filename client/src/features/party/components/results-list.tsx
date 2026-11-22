import type { PartyPlayer, PartyResult } from '@/bridge/party';
import { partyTone } from '@/features/party/lib/party-tones';
import { t } from '@/i18n';
import { cn } from '@/shared/utils/cn';

import { ScoreGauge } from './score-gauge';

const NO_PLAYERS: PartyPlayer[] = [];

/** Ranked round results as contestant cards with the three arcade gauges. */
export const ResultsList = ({
  results,
  players = NO_PLAYERS,
}: {
  results: PartyResult[];
  players?: PartyPlayer[];
}) => (
  <ol className="flex flex-col gap-4">
    {results.map((result, index) => {
      const color = players.find((player) => player.id === result.playerId)?.color;
      const tone = partyTone(color, index);
      return (
        <li
          key={result.playerId}
          className={cn(
            'flex flex-col gap-2 rounded-2xl border-t-8 bg-card p-3 shadow-[0_6px_0_black]',
            tone.border,
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 font-party text-lg font-black">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-sm',
                  index === 0 ? 'bg-yellow-400 text-yellow-950' : 'bg-muted text-white',
                )}
              >
                {index + 1}
              </span>
              <span className="truncate">{result.name}</span>
            </span>
            <span className="rounded-lg bg-black px-3 py-0.5 font-party text-xl font-black tabular-nums text-yellow-400">
              {result.score}
            </span>
          </div>
          <ScoreGauge label={t('party.gauges.pitch')} value={result.pitch} tone={tone} />
          <ScoreGauge label={t('party.gauges.rhythm')} value={result.rhythm} tone={tone} />
          <ScoreGauge label={t('party.gauges.lyrics')} value={result.lyrics} tone={tone} />
        </li>
      );
    })}
  </ol>
);

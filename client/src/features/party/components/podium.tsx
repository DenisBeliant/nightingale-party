import { CrownIcon } from 'lucide-react';

import type { PartyPlayer, PartyResult } from '@/bridge/party';
import { partyTone } from '@/features/party/lib/party-tones';
import { cn } from '@/shared/utils/cn';

/** Height of the step for ranks 1, 2 and 3. */
const STEP_HEIGHT = ['h-40 sm:h-64', 'h-28 sm:h-44', 'h-20 sm:h-32'];
const STEP_NUMBER = ['text-6xl sm:text-8xl', 'text-5xl sm:text-7xl', 'text-4xl sm:text-6xl'];

type Placed = { result: PartyResult; rank: number };

/** Classic 2-1-3 order: the winner stands in the middle. */
const podiumOrder = (results: PartyResult[]): Placed[] => {
  const placed = results.slice(0, 3).map((result, rank) => ({ result, rank }));
  return [1, 0, 2].filter((rank) => rank < placed.length).map((rank) => placed[rank]);
};

const colorOf = (players: PartyPlayer[], playerId: string) =>
  players.find((player) => player.id === playerId)?.color;

const Step = ({ entry, players }: { entry: Placed; players: PartyPlayer[] }) => {
  const { result, rank } = entry;
  const tone = partyTone(colorOf(players, result.playerId), rank);
  const winner = rank === 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      {winner && (
        <CrownIcon
          className="size-10 fill-yellow-400 text-yellow-700 sm:size-14"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          'max-w-full truncate font-party font-black',
          winner ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl',
        )}
      >
        {result.name}
      </span>
      <span className={cn('font-party font-extrabold tabular-nums sm:text-2xl', tone.soft)}>
        {result.score}
      </span>
      <div
        className={cn(
          'flex w-full justify-center rounded-t-2xl pt-3 font-party font-black shadow-[inset_0_-10px_0_rgb(0_0_0/0.3)]',
          tone.fill,
          tone.ink,
          STEP_HEIGHT[rank],
          STEP_NUMBER[rank],
        )}
      >
        {rank + 1}
      </div>
    </div>
  );
};

/** Results podium of a round; a fourth player is listed under it. */
export const Podium = ({
  results,
  players,
  className,
}: {
  results: PartyResult[];
  players: PartyPlayer[];
  className?: string;
}) => (
  <div className={cn('flex flex-col gap-3', className)}>
    <div className="flex items-end gap-3 sm:gap-5">
      {podiumOrder(results).map((entry) => (
        <Step key={entry.result.playerId} entry={entry} players={players} />
      ))}
    </div>
    {results.slice(3).map((result, offset) => (
      <p key={result.playerId} className="text-center font-party font-bold text-white/70">
        {offset + 4}. {result.name} · <span className="tabular-nums">{result.score}</span>
      </p>
    ))}
  </div>
);

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { CHUNKY, chunkyClass, type ChunkyTone } from '@/features/party/lib/party-tones';
import { cn } from '@/shared/utils/cn';

type ChunkyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  tone?: ChunkyTone;
  submit?: boolean;
};

export const ChunkyButton = ({
  tone = 'primary',
  submit,
  className,
  ...props
}: ChunkyButtonProps) => (
  <button
    type={submit === true ? 'submit' : 'button'}
    className={chunkyClass(tone, className)}
    {...props}
  />
);

/** Tilted announcement banner ("Let's karaoke!", "And the winner is…"). */
export const StageBanner = ({
  children,
  tone = 'primary',
  className,
}: {
  children: ReactNode;
  tone?: ChunkyTone;
  className?: string;
}) => (
  <div
    className={cn(
      'inline-block -rotate-2 rounded-2xl px-6 py-2 text-center font-party text-2xl font-black sm:px-10 sm:py-3 sm:text-4xl',
      CHUNKY[tone],
      className,
    )}
  >
    {children}
  </div>
);

/** Two spotlights and a lighter floor behind a party screen. */
export const StageBackdrop = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute -top-32 left-[8%] h-[130%] w-[26%] origin-top rotate-[18deg] bg-linear-to-b from-primary/30 to-transparent blur-sm" />
    <div className="absolute -top-32 right-[8%] h-[130%] w-[26%] origin-top -rotate-[18deg] bg-linear-to-b from-yellow-400/20 to-transparent blur-sm" />
    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-b from-[#1A1A2C] to-[#10101C]" />
  </div>
);

const CONFETTI_COLORS = [
  'bg-rose-500',
  'bg-fuchsia-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-primary',
  'bg-yellow-400',
];

const CONFETTI = Array.from({ length: 28 }, (_, id) => ({
  id,
  left: `${(id * 37) % 100}%`,
  top: `${((id * 23) % 50) + 4}%`,
  rotate: `rotate(${(id * 47) % 180}deg)`,
  color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
}));

/** Static confetti for the results screen. */
export const Confetti = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    {CONFETTI.map((piece) => (
      <span
        key={piece.id}
        className={cn('absolute h-4 w-2.5 rounded-xs', piece.color)}
        style={{ left: piece.left, top: piece.top, transform: piece.rotate }}
      />
    ))}
  </div>
);

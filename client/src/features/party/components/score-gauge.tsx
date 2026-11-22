import type { PartyTone } from '@/features/party/lib/party-tones';
import { cn } from '@/shared/utils/cn';

type ScoreGaugeProps = {
  label: string;
  /** 0–100. */
  value: number;
  /** Player colour of the bar; the app's primary blue by default. */
  tone?: PartyTone;
  size?: 'sm' | 'md';
  showValue?: boolean;
  className?: string;
};

/** Five tick marks drawn over the bar, like a game show meter. */
const TICKS = {
  backgroundImage:
    'repeating-linear-gradient(90deg, transparent 0 19.4%, rgb(13 13 22 / 0.75) 19.4% 20%)',
};

/** Arcade gauge: a thick pill that fills from 0 to 100, with ticks. */
export const ScoreGauge = ({
  label,
  value,
  tone,
  size = 'md',
  showValue = true,
  className,
}: ScoreGaugeProps) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const small = size === 'sm';
  return (
    <div className={cn('flex items-center gap-2', small ? 'text-[0.65rem]' : 'text-xs', className)}>
      <span className={cn('shrink-0 font-bold text-white/80', small ? 'w-14' : 'w-16')}>
        {label}
      </span>
      <div
        className={cn(
          'relative flex-1 overflow-hidden rounded-full bg-black/55',
          small ? 'h-2.5' : 'h-4',
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            tone?.bar ?? 'bg-primary',
          )}
          style={{ width: `${clamped}%` }}
        />
        <div aria-hidden="true" className="absolute inset-0" style={TICKS} />
      </div>
      {showValue && (
        <span className="w-8 shrink-0 text-right font-bold tabular-nums text-white">{clamped}</span>
      )}
    </div>
  );
};

import type { PartyColor } from '@/bridge/party';
import { cn } from '@/shared/utils/cn';

/** Classes of one player's colour in the "game show" party style. */
export type PartyTone = {
  /** Solid plate (desk, podium step, chip). */
  fill: string;
  /** Hard drop shadow under a plate: the "set piece" relief. */
  shadow: string;
  /** Text drawn on top of `fill`. */
  ink: string;
  /** Light variant for text on the dark stage. */
  soft: string;
  /** Top border of a desk card. */
  border: string;
  /** Fill of a gauge. */
  bar: string;
  /** Ring around the singing microphone. */
  ring: string;
};

export const PARTY_TONES: Record<PartyColor, PartyTone> = {
  rose: {
    fill: 'bg-rose-500',
    shadow: 'shadow-[0_8px_0_var(--color-rose-800)]',
    ink: 'text-white',
    soft: 'text-rose-200',
    border: 'border-t-rose-500',
    bar: 'bg-rose-500',
    ring: 'border-rose-500 bg-rose-500/25',
  },
  fuchsia: {
    fill: 'bg-fuchsia-500',
    shadow: 'shadow-[0_8px_0_var(--color-fuchsia-800)]',
    ink: 'text-white',
    soft: 'text-fuchsia-200',
    border: 'border-t-fuchsia-500',
    bar: 'bg-fuchsia-500',
    ring: 'border-fuchsia-500 bg-fuchsia-500/25',
  },
  amber: {
    fill: 'bg-amber-500',
    shadow: 'shadow-[0_8px_0_var(--color-amber-800)]',
    ink: 'text-amber-950',
    soft: 'text-amber-200',
    border: 'border-t-amber-500',
    bar: 'bg-amber-500',
    ring: 'border-amber-500 bg-amber-500/25',
  },
  emerald: {
    fill: 'bg-emerald-500',
    shadow: 'shadow-[0_8px_0_var(--color-emerald-800)]',
    ink: 'text-emerald-950',
    soft: 'text-emerald-200',
    border: 'border-t-emerald-500',
    bar: 'bg-emerald-500',
    ring: 'border-emerald-500 bg-emerald-500/25',
  },
};

const PARTY_COLOR_ORDER: readonly PartyColor[] = ['rose', 'fuchsia', 'amber', 'emerald'];

/** The tone of a colour, or of a seat index when the colour is unknown. */
export const partyTone = (color: PartyColor | undefined, index = 0): PartyTone =>
  PARTY_TONES[color ?? PARTY_COLOR_ORDER[index % PARTY_COLOR_ORDER.length]];

export type ChunkyTone = 'primary' | 'gold' | 'plain';

export const CHUNKY: Record<ChunkyTone, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-[0_6px_0_color-mix(in_srgb,var(--primary)_55%,black)]',
  gold: 'bg-yellow-400 text-yellow-950 shadow-[0_6px_0_var(--color-yellow-700)]',
  plain: 'bg-card text-card-foreground shadow-[0_6px_0_black]',
};

/** Classes of a thick "game show" button that sinks when pressed. */
export const chunkyClass = (tone: ChunkyTone, className?: string): string =>
  cn(
    'rounded-2xl font-party font-black outline-none transition-[translate,box-shadow] duration-75',
    'active:translate-y-1 active:shadow-none focus-visible:ring-4 focus-visible:ring-ring/60',
    'disabled:pointer-events-none disabled:opacity-50',
    CHUNKY[tone],
    className,
  );

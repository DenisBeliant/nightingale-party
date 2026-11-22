import { t } from '@/i18n';

import { StageBanner } from './stage';

/** Full-screen "3, 2, 1" before a party round starts the song. */
export const PartyCountdown = ({ value }: { value: number }) => (
  <output
    aria-live="assertive"
    className="dark absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/70 text-foreground backdrop-blur-sm"
  >
    <StageBanner>{t('party.countdown.ready')}</StageBanner>
    <span
      key={value}
      className="flex size-48 items-center justify-center rounded-full bg-yellow-400 font-party text-9xl font-black text-yellow-950 shadow-[0_12px_0_var(--color-yellow-700)] animate-in duration-300 fade-in zoom-in-50 sm:size-64 sm:text-[10rem]"
    >
      {value}
    </span>
  </output>
);

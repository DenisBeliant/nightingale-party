import { useMutation } from '@tanstack/react-query';
import { ArrowLeftIcon, MonitorIcon, SquareIcon, TvIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';

import {
  startTvServer,
  stopTvServer,
  tvServerAvailable,
  type TvServerStatus,
} from '@/bridge/tv-server';
import { ChunkyButton, StageBackdrop, StageBanner } from '@/features/party/components/stage';
import { useTvServer } from '@/features/party/hooks/use-tv-server';
import { t } from '@/i18n';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/ui/spinner';

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const Choice = ({
  icon,
  title,
  hint,
  busy,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  busy: boolean;
  onClick: () => void;
}) => (
  <ChunkyButton
    tone="plain"
    disabled={busy}
    onClick={onClick}
    className="flex min-h-56 flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
  >
    {icon}
    <span className="text-3xl">{title}</span>
    <span className="max-w-sm text-base font-semibold text-white/65">{hint}</span>
  </ChunkyButton>
);

/** The TV server is on: how to open it on the TV, and how to stop. */
const OnTheTv = ({ status, onStop }: { status: TvServerStatus; onStop: () => void }) => (
  <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 rounded-3xl border-4 border-white bg-card p-8 text-center shadow-[0_10px_0_black]">
    <span className="flex items-center gap-2 rounded-xl bg-[#14142A] px-3 py-1 font-party text-sm font-extrabold uppercase">
      <span className="size-2.5 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
      {t('party.play.tvLive')}
    </span>
    <TvIcon className="size-16 text-primary" aria-hidden="true" />
    <p className="font-party text-2xl leading-snug font-black">
      {t('party.play.tvSteps', { name: status.name })}
    </p>
    {status.url !== null && (
      <p className="text-sm text-white/65">
        {t('party.play.tvAddress')} <span className="font-mono">{status.url}</span>
      </p>
    )}
    <p className="text-sm text-white/65">{t('party.play.keepOpen')}</p>
    <ChunkyButton
      tone="gold"
      onClick={onStop}
      className="flex items-center gap-2 px-6 py-4 text-xl"
    >
      <SquareIcon className="size-5" aria-hidden="true" />
      {t('party.play.tvStop')}
    </ChunkyButton>
  </div>
);

const usePlayChoice = () => {
  const navigate = useNavigate();
  const status = useTvServer();
  const start = useMutation({ mutationFn: startTvServer });
  const stop = useMutation({ mutationFn: stopTvServer });

  const playHere = async () => {
    if (status?.running === true) {
      await stop.mutateAsync().catch(() => undefined);
    }
    void navigate('/party');
  };

  const failure = start.error === null ? (status?.error ?? null) : errorMessage(start.error);
  return {
    status,
    busy: start.isPending || stop.isPending,
    failure,
    playHere: () => void playHere(),
    playOnTv: () => start.mutate(),
    stopTv: () => stop.mutate(),
  };
};

const PlayContent = () => {
  const play = usePlayChoice();
  if (play.status === undefined) {
    return <Spinner className="m-auto" />;
  }
  if (play.status.running) {
    return <OnTheTv status={play.status} onStop={play.stopTv} />;
  }
  return (
    <>
      <div className="flex justify-center">
        <StageBanner>{t('party.play.title')}</StageBanner>
      </div>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 sm:flex-row">
        <Choice
          icon={<MonitorIcon className="size-14" aria-hidden="true" />}
          title={t('party.play.here')}
          hint={t('party.play.hereHint')}
          busy={play.busy}
          onClick={play.playHere}
        />
        <Choice
          icon={<TvIcon className="size-14" aria-hidden="true" />}
          title={t('party.play.tv')}
          hint={t('party.play.tvHint')}
          busy={play.busy}
          onClick={play.playOnTv}
        />
      </div>
      {play.failure !== null && (
        <p className="mx-auto max-w-xl rounded-2xl bg-destructive/25 px-4 py-3 text-center font-semibold">
          {t('party.play.tvFailed', { value1: play.failure })}
        </p>
      )}
    </>
  );
};

/**
 * "Jouer" on the desktop: play the party on this computer, or serve it to the
 * Nightingale TV app. Elsewhere (browser, TV) it is the party screen directly.
 */
export const PlayPage = () => {
  const navigate = useNavigate();
  if (!tvServerAvailable) {
    return <Navigate to="/party" replace />;
  }
  return (
    <div className="dark relative h-full overflow-hidden bg-background text-foreground">
      <StageBackdrop />
      <div className="relative flex h-full flex-col gap-8 overflow-y-auto px-4 pt-14 pb-8 sm:px-8 md:pt-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => void navigate('/')}>
            <ArrowLeftIcon />
            {t('common.actions.back')}
          </Button>
        </div>
        <h1 className="sr-only">{t('party.play.title')}</h1>
        <PlayContent />
      </div>
    </div>
  );
};

import { ArrowLeftIcon, XIcon } from 'lucide-react';
import { useNavigate } from 'react-router';

import type { PartyView } from '@/bridge/party';
import { FreeSeat, PlayerDesk } from '@/features/party/components/player-desk';
import { Podium } from '@/features/party/components/podium';
import { Confetti, StageBackdrop, StageBanner } from '@/features/party/components/stage';
import { t } from '@/i18n';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/ui/spinner';
import { isTvMode } from '@/shared/tv-mode';
import { cn } from '@/shared/utils/cn';

import { usePartyHost } from './use-party-host';

type Host = ReturnType<typeof usePartyHost>;

const qrSource = (qrSvg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;

const NoNetwork = () => (
  <p className="max-w-md rounded-2xl bg-destructive/25 px-5 py-4 text-center font-bold">
    {t('party.host.noNetwork')}
  </p>
);

/** The big "scan to join" card in the middle of the stage. */
const QrCard = ({ host }: { host: Host }) => {
  const { url, qrSvg, view } = host;
  if (url === null || qrSvg === null) {
    return <NoNetwork />;
  }
  return (
    <div className="flex flex-col items-center gap-5 rounded-3xl border-4 border-white bg-card p-5 shadow-[0_10px_0_black] sm:flex-row sm:gap-7 sm:p-6">
      <img
        src={qrSource(qrSvg)}
        alt={t('party.host.scanToJoin')}
        className="w-48 rounded-xl bg-white p-2 sm:w-56"
      />
      <div className="flex max-w-xs flex-col gap-3 text-center sm:text-left">
        <span className="font-party text-3xl leading-tight font-black sm:text-4xl">
          {t('party.host.scanTitle')}
        </span>
        <span className="font-semibold text-white/80">{t('party.host.scanHint')}</span>
        {view !== null && (
          <span className="self-center rounded-full bg-yellow-400 px-4 py-1.5 font-party font-extrabold text-yellow-950 sm:self-start">
            {t('party.host.playerCount', { count: view.players.length, max: view.maxPlayers })}
          </span>
        )}
        <span className="font-mono text-xs break-all text-white/60">{url}</span>
      </div>
    </div>
  );
};

const statusText = (view: PartyView): string => {
  const master = view.players.find((player) => player.master);
  if (view.players.length === 0) {
    return t('party.host.waitingFirst');
  }
  if (view.players.length < view.minPlayers) {
    return t('party.host.waitingMore', { count: view.minPlayers });
  }
  if (view.phase === 'playing') {
    return t('party.host.playing');
  }
  if (view.selection === null) {
    return t('party.host.masterChoosing', { name: master?.name ?? '' });
  }
  return t('party.host.readyToStart', { name: master?.name ?? '' });
};

/** The row of contestant desks, with free seats up to the player limit. */
const Desks = ({ view }: { view: PartyView }) => {
  const free = Math.max(0, view.maxPlayers - view.players.length);
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-2 items-end gap-x-5 gap-y-6 sm:grid-cols-4 sm:gap-x-7">
      {view.players.map((player, index) => (
        <PlayerDesk key={player.id} player={player} index={index} />
      ))}
      {Array.from({ length: free }, (_, seat) => (
        <FreeSeat key={`free-${seat}`} />
      ))}
    </div>
  );
};

const LobbyStage = ({ host, view }: { host: Host; view: PartyView }) => (
  <>
    <div className="flex justify-center">
      <StageBanner>{t('party.host.banner')}</StageBanner>
    </div>
    <div className="flex flex-col items-center gap-4">
      <QrCard host={host} />
      <p className="rounded-2xl bg-card/80 px-5 py-2 text-center font-party text-lg font-bold">
        {statusText(view)}
      </p>
      <p className="max-w-lg text-center text-xs text-white/55">
        {t('party.host.certificateHint')}
      </p>
    </div>
    <div className="mt-auto pt-4">
      <Desks view={view} />
    </div>
  </>
);

const JoinCard = ({ host, className }: { host: Host; className?: string }) => (
  <div
    className={cn(
      'flex flex-col items-center gap-3 rounded-3xl bg-card p-4 shadow-[0_6px_0_black]',
      className,
    )}
  >
    {host.qrSvg !== null && (
      <img
        src={qrSource(host.qrSvg)}
        alt={t('party.host.scanToJoin')}
        className="w-32 rounded-lg bg-white p-1.5"
      />
    )}
    <span className="text-center text-sm font-bold text-white/80">
      {t('party.results.joinNext')}
    </span>
  </div>
);

const ResultsStage = ({ host, view }: { host: Host; view: PartyView }) => {
  const master = view.players.find((player) => player.master)?.name ?? view.results[0].name;
  return (
    <>
      <Confetti />
      <div className="relative flex justify-center">
        <StageBanner tone="gold">{t('party.results.winnerIs')}</StageBanner>
      </div>
      <div className="relative mt-auto grid items-end gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_14rem]">
        <p className="self-center rounded-3xl bg-primary p-5 font-party text-xl leading-snug font-extrabold text-primary-foreground shadow-[0_6px_0_color-mix(in_srgb,var(--primary)_55%,black)]">
          {t('party.results.nextMaster', { name: master })}
        </p>
        <Podium
          results={view.results}
          players={view.players}
          className="mx-auto w-full max-w-3xl"
        />
        <JoinCard host={host} className="self-center" />
      </div>
    </>
  );
};

const Stage = ({ host }: { host: Host }) => {
  const view = host.view;
  if (view === null) {
    return <Spinner className="m-auto" />;
  }
  if (view.phase === 'results' && view.results.length > 0) {
    return <ResultsStage host={host} view={view} />;
  }
  return <LobbyStage host={host} view={view} />;
};

/** Host screen of a multiplayer party, styled as a TV game show stage. */
export const PartyHostPage = () => {
  const navigate = useNavigate();
  const host = usePartyHost();
  // On a TV the party is the whole app: there is no menu to go back to.
  const tv = isTvMode();

  return (
    <div className="dark relative h-full overflow-hidden bg-background text-foreground">
      <StageBackdrop />
      <div className="relative flex h-full flex-col gap-6 overflow-y-auto px-4 pt-14 pb-8 sm:px-8 md:pt-6">
        <div className="flex items-center justify-between gap-3">
          {tv ? (
            <span />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => void navigate('/')}>
              <ArrowLeftIcon />
              {t('common.actions.back')}
            </Button>
          )}
          <h1 className="sr-only">{t('party.host.title')}</h1>
          <Button variant="outline" size="sm" onClick={() => void host.close()}>
            <XIcon />
            {t('party.host.close')}
          </Button>
        </div>
        <Stage host={host} />
      </div>
    </div>
  );
};

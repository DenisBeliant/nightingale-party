import { MicIcon, MicOffIcon, SquareIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import type { PartyPhoneView, PartyPlayer } from '@/bridge/party';
import { PlayerList } from '@/features/party/components/player-list';
import { ResultsList } from '@/features/party/components/results-list';
import { ChunkyButton } from '@/features/party/components/stage';
import { partyTone } from '@/features/party/lib/party-tones';
import { t, tp } from '@/i18n';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Spinner } from '@/shared/components/ui/spinner';
import { cn } from '@/shared/utils/cn';

import { MasterPicker } from './master-picker';
import { usePartyPhone, type MicStatus } from './use-party-phone';

type Phone = ReturnType<typeof usePartyPhone>;

const JoinForm = ({ phone }: { phone: Phone }) => {
  const [name, setName] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void phone.join(name);
  };
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-5 pt-6">
      <h1 className="font-party text-4xl leading-tight font-black">{t('party.phone.welcome')}</h1>
      <p className="text-white/75">{t('party.phone.chooseNickname')}</p>
      <div className="flex flex-col gap-2">
        <label htmlFor="party-nickname" className="text-sm font-bold text-white/70">
          {t('party.phone.nickname')}
        </label>
        <Input
          id="party-nickname"
          value={name}
          maxLength={20}
          onChange={(event) => setName(event.target.value)}
          className="h-14 rounded-2xl border-2 border-primary bg-card px-4 font-party text-2xl font-black"
        />
      </div>
      <ChunkyButton
        submit
        tone="gold"
        disabled={phone.busy || name.trim() === ''}
        className="mt-auto py-5 text-2xl"
      >
        {t('party.phone.join')}
      </ChunkyButton>
    </form>
  );
};

/** My name plate, and the master badge when I pick the songs. */
const MeHeader = ({ me }: { me: PartyPlayer | null }) => {
  if (me === null) {
    return null;
  }
  const tone = partyTone(me.color);
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'max-w-[60%] truncate rounded-xl px-3 py-1.5 font-party text-lg font-black shadow-[0_4px_0_rgb(0_0_0/0.45)]',
          tone.fill,
          tone.ink,
        )}
      >
        {me.name}
      </span>
      {me.master && (
        <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-xs font-extrabold text-yellow-950 uppercase">
          {t('party.players.master')}
        </span>
      )}
    </div>
  );
};

const MicNotice = ({ status, onEnable }: { status: MicStatus; onEnable: () => void }) => {
  if (status === 'on') {
    return null;
  }
  if (status === 'insecure') {
    return (
      <p className="rounded-2xl bg-destructive/25 px-4 py-3 font-semibold">
        {t('party.phone.micInsecure')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-amber-500/60 bg-card p-4">
      <p className="font-semibold">
        {t(status === 'denied' ? 'party.phone.micDenied' : 'party.phone.micOff')}
      </p>
      <ChunkyButton
        tone="primary"
        onClick={onEnable}
        className="flex items-center justify-center gap-2 py-3 text-lg"
      >
        <MicIcon className="size-5" aria-hidden="true" />
        {t('party.phone.enableMic')}
      </ChunkyButton>
    </div>
  );
};

const Singing = ({ phone, view }: { phone: Phone; view: PartyPhoneView }) => {
  const song = view.party.currentSong;
  const tone = partyTone(view.me?.color);
  const on = phone.micStatus === 'on';
  return (
    <div className="flex flex-1 flex-col items-center gap-6 text-center">
      <div>
        <p className="text-sm font-bold text-white/60 uppercase">{t('party.phone.nowPlaying')}</p>
        <p className="font-party text-2xl font-black">{song?.title}</p>
        <p className="text-white/70">{song?.artist}</p>
      </div>
      {on ? (
        <>
          <div
            className={cn(
              'my-4 flex size-56 items-center justify-center rounded-full border-8 transition-transform duration-100',
              tone.ring,
            )}
            style={{ transform: `scale(${0.85 + phone.level * 0.3})` }}
          >
            <MicIcon className="size-20" aria-hidden="true" />
          </div>
          <p className="font-party text-4xl font-black">{t('party.phone.sing')}</p>
          <p className="text-white/65">{t('party.phone.holdClose')}</p>
        </>
      ) : (
        <>
          <MicOffIcon className="my-4 size-20 text-white/50" aria-hidden="true" />
          <MicNotice status={phone.micStatus} onEnable={() => void phone.enableMic()} />
        </>
      )}
      {view.me?.master === true && (
        <ChunkyButton
          tone="plain"
          disabled={phone.busy}
          onClick={() => void phone.stop()}
          className="mt-auto flex w-full items-center justify-center gap-2 py-4 text-lg"
        >
          <SquareIcon className="size-5" aria-hidden="true" />
          {t('party.phone.stopRound')}
        </ChunkyButton>
      )}
    </div>
  );
};

const ReadyDots = ({ players }: { players: PartyPlayer[] }) => (
  <div className="flex items-center gap-2 text-sm font-bold text-white/75">
    {players.map((player, index) => (
      <span
        key={player.id}
        className={cn('size-3 rounded-full', partyTone(player.color, index).fill)}
        aria-hidden="true"
      />
    ))}
    <span>{tp('party.phone.playersReady', players.length)}</span>
  </div>
);

const NextRound = ({ phone, view }: { phone: Phone; view: PartyPhoneView }) => {
  const { party, me } = view;
  const master = party.players.find((player) => player.master);
  const enoughPlayers = party.players.length >= party.minPlayers;

  if (me?.master !== true) {
    return (
      <p className="rounded-2xl bg-card px-4 py-4 text-center font-party text-lg font-bold">
        {t('party.phone.waitingForMaster', { name: master?.name ?? '' })}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-party text-3xl leading-tight font-black">
        {t('party.phone.whatToSing')}
      </h2>
      <MasterPicker busy={phone.busy} onPick={(request) => void phone.pick(request)} />
      <ReadyDots players={party.players} />
      <ChunkyButton
        tone="gold"
        disabled={phone.busy || party.selection === null || !enoughPlayers}
        onClick={() => void phone.start()}
        className="py-5 text-2xl"
      >
        {t('party.phone.start')}
      </ChunkyButton>
      {!enoughPlayers && (
        <p className="text-center text-sm text-white/65">
          {t('party.phone.needPlayers', { count: party.minPlayers })}
        </p>
      )}
    </div>
  );
};

const selectionText = (view: PartyPhoneView): string | null => {
  const selection = view.party.selection;
  if (selection === null) {
    return null;
  }
  if (selection.mode === 'random') {
    return t('party.selection.random');
  }
  if (selection.mode === 'genre') {
    return t('party.selection.genre', { genre: selection.label });
  }
  return selection.label;
};

const Lobby = ({ phone, view }: { phone: Phone; view: PartyPhoneView }) => {
  const next = selectionText(view);
  return (
    <div className="flex flex-col gap-6">
      {view.party.phase === 'results' && view.party.results.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-party text-2xl font-black">{t('party.results.title')}</h2>
          <ResultsList results={view.party.results} players={view.party.players} />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-party text-xl font-black">{t('party.players.title')}</h2>
        <PlayerList players={view.party.players} meId={view.me?.id} />
      </section>
      {next !== null && (
        <p className="rounded-2xl bg-primary/20 px-4 py-3 font-bold">
          {t('party.selection.next', { label: next })}
        </p>
      )}
      <MicNotice status={phone.micStatus} onEnable={() => void phone.enableMic()} />
      <NextRound phone={phone} view={view} />
      <Button variant="ghost" size="sm" onClick={() => void phone.leave()}>
        {t('party.phone.leave')}
      </Button>
    </div>
  );
};

const Body = ({ phone }: { phone: Phone }) => {
  if (phone.loading) {
    return <Spinner className="m-auto" />;
  }
  const view = phone.view;
  if (view === null) {
    return <JoinForm phone={phone} />;
  }
  if (!view.party.open) {
    return (
      <p className="m-auto text-center font-party text-xl font-bold">{t('party.phone.closed')}</p>
    );
  }
  return (
    <>
      <MeHeader me={view.me} />
      {view.party.phase === 'playing' ? (
        <Singing phone={phone} view={view} />
      ) : (
        <Lobby phone={phone} view={view} />
      )}
    </>
  );
};

/** Phone page of a multiplayer party, reached by scanning the host's QR code. */
export const PartyPhonePage = () => {
  const phone = usePartyPhone();
  return (
    <main className="dark h-svh overflow-y-auto overscroll-contain bg-linear-to-b from-[#14142A] to-background text-foreground">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 p-5 pb-10">
        <Body phone={phone} />
        {phone.error !== null && (
          <p className="rounded-xl bg-destructive/25 px-3 py-2 text-sm font-semibold">
            {phone.error}
          </p>
        )}
      </div>
    </main>
  );
};

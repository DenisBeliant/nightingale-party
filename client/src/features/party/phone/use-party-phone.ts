import { useCallback, useEffect, useRef, useState } from 'react';

import {
  joinParty,
  leaveParty,
  loadPartyMe,
  pickPartySong,
  sendPartyPitch,
  startPartyRound,
  stopPartyRound,
  type PartyPhoneView,
  type PartyPickRequest,
  type PartyView,
} from '@/bridge/party';
import { listen } from '@/bridge/runtime';
import { loadPartySecret, savePartySecret } from '@/features/party/lib/party-secret';
import { InsecurePageError, PhoneMic } from '@/features/party/lib/phone-mic';

/** ~10 pitch updates per second: plenty for arcade scoring on a LAN. */
const PITCH_SEND_MS = 100;

export type MicStatus = 'off' | 'on' | 'denied' | 'insecure';

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const withParty = (previous: PartyPhoneView | null, party: PartyView): PartyPhoneView | null => {
  if (previous === null) {
    return null;
  }
  const me = party.players.find((player) => player.id === previous.me?.id) ?? null;
  return { party, me };
};

const useMicrophone = () => {
  const micRef = useRef<PhoneMic | null>(null);
  const [status, setStatus] = useState<MicStatus>('off');

  const enable = useCallback(async () => {
    micRef.current ??= new PhoneMic();
    try {
      await micRef.current.start();
      setStatus('on');
    } catch (error) {
      setStatus(error instanceof InsecurePageError ? 'insecure' : 'denied');
    }
  }, []);

  useEffect(() => () => micRef.current?.stop(), []);

  return { micRef, status, enable };
};

/** Streams the sung pitch while a round plays; returns the live level. */
const usePitchStream = (secret: string | null, active: boolean, mic: PhoneMic | null) => {
  const [level, setLevel] = useState(0);
  const sending = useRef(false);

  useEffect(() => {
    if (!active || secret === null || mic === null) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      const hz = mic.readPitch();
      setLevel(mic.level());
      if (sending.current) {
        return;
      }
      sending.current = true;
      void sendPartyPitch(secret, hz)
        .catch(() => undefined)
        .finally(() => {
          sending.current = false;
        });
    }, PITCH_SEND_MS);
    return () => window.clearInterval(timer);
  }, [active, secret, mic]);

  return level;
};

const usePartyEvents = (
  setView: (update: (prev: PartyPhoneView | null) => PartyPhoneView | null) => void,
) => {
  useEffect(() => {
    const pending = listen<PartyView>('party-changed', (event) => {
      setView((previous) => withParty(previous, event.payload));
    });
    return () => {
      void pending.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [setView]);
};

export const usePartyPhone = () => {
  const [secret, setSecret] = useState<string | null>(loadPartySecret);
  const [view, setView] = useState<PartyPhoneView | null>(null);
  const [loading, setLoading] = useState(secret !== null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mic = useMicrophone();

  usePartyEvents(setView);

  useEffect(() => {
    if (secret === null) {
      return;
    }
    const restore = async () => {
      try {
        const next = await loadPartyMe(secret);
        setView(next.me === null ? null : next);
      } catch {
        setView(null);
      } finally {
        setLoading(false);
      }
    };
    void restore();
  }, [secret]);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const join = useCallback(
    async (name: string) =>
      await run(async () => {
        await mic.enable();
        const joined = await joinParty(name, secret);
        savePartySecret(joined.secret);
        setSecret(joined.secret);
        setView(joined.view);
      }),
    [mic, run, secret],
  );

  const pick = useCallback(
    async (request: PartyPickRequest) => {
      if (secret !== null) {
        await run(async () => await pickPartySong(secret, request));
      }
    },
    [run, secret],
  );

  const start = useCallback(async () => {
    if (secret !== null) {
      await run(async () => await startPartyRound(secret));
    }
  }, [run, secret]);

  const stop = useCallback(async () => {
    if (secret !== null) {
      await run(async () => await stopPartyRound(secret));
    }
  }, [run, secret]);

  const leave = useCallback(async () => {
    if (secret !== null) {
      await leaveParty(secret).catch(() => undefined);
    }
    savePartySecret(null);
    setSecret(null);
    setView(null);
  }, [secret]);

  const playing = view?.party.phase === 'playing' && view.me !== null;
  const level = usePitchStream(secret, playing && mic.status === 'on', mic.micRef.current);

  return {
    view,
    loading,
    error,
    busy,
    micStatus: mic.status,
    enableMic: mic.enable,
    level,
    join,
    pick,
    start,
    stop,
    leave,
  };
};

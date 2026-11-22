import { useEffect, useState } from 'react';

import type { PartyPitch } from '@/bridge/party';
import { listen } from '@/bridge/runtime';

/** A phone that stopped sending for this long counts as silent. */
const STALE_MS = 400;
const TICK_MS = 33;

type Latest = { hz: number | null; at: number };

const latest = new Map<string, Latest>();
let subscription: Promise<() => void> | null = null;
let users = 0;

const subscribe = (): void => {
  users += 1;
  subscription ??= listen<PartyPitch>('party-pitch', (event) => {
    latest.set(event.payload.playerId, { hz: event.payload.hz, at: performance.now() });
  });
};

const unsubscribe = (): void => {
  users -= 1;
  if (users <= 0 && subscription !== null) {
    void subscription.then((unlisten) => unlisten()).catch(() => undefined);
    subscription = null;
    latest.clear();
  }
};

const currentPitch = (playerId: string): number | null => {
  const entry = latest.get(playerId);
  if (entry === undefined || performance.now() - entry.at > STALE_MS) {
    return null;
  }
  return entry.hz;
};

/** `party:<id>` microphone ids designate a phone in a party round. */
export const partyPlayerId = (microphoneId: string | null): string | null =>
  microphoneId?.startsWith('party:') === true ? microphoneId.slice('party:'.length) : null;

/** Live sung pitch of a party phone, like `useMicPitch` for a local mic. */
export const usePartyPitch = (playerId: string | null, enabled: boolean): number | null => {
  const [pitch, setPitch] = useState<number | null>(null);

  const active = playerId !== null && enabled;

  useEffect(() => {
    if (playerId === null || !enabled) {
      return undefined;
    }
    subscribe();
    const timer = window.setInterval(() => setPitch(currentPitch(playerId)), TICK_MS);
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [playerId, enabled]);

  return active ? pitch : null;
};

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import {
  closeParty,
  openParty,
  type PartyOpenResult,
  type PartyRound,
  type PartyView,
} from '@/bridge/party';
import type { PlaybackPlayer } from '@/bridge/playback-session';
import { listen } from '@/bridge/runtime';
import { loadSongsByHashes } from '@/bridge/songs';
import { useTvServer } from '@/features/party/hooks/use-tv-server';
import { markPartyReturn, takePartyReturn } from '@/features/party/lib/party-return';
import { usePlaybackLauncher } from '@/features/playback/hooks/use-playback-launcher';
import { t } from '@/i18n';
import { useLatestRef } from '@/shared/hooks/use-latest-ref';
import { isTvMode } from '@/shared/tv-mode';

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const roundPlayers = (round: PartyRound): PlaybackPlayer[] =>
  round.players.map((player) => ({
    id: player.id,
    profile: player.name,
    microphoneId: `party:${player.id}`,
    color: player.color,
  }));

const release = (pending: Promise<() => void>): void => {
  void pending.then((unlisten) => unlisten()).catch(() => undefined);
};

/**
 * Lives in the menu layout: starts playback when the game master launches a
 * round, and brings the window back to the party screen after a round.
 */
export const usePartyHostListener = (): void => {
  const navigate = useNavigate();
  const { launch, reserveTarget } = usePlaybackLauncher();
  // While the desktop serves the TV, the TV plays the rounds, not this window.
  const tv = useTvServer();
  const playsOnTvRef = useLatestRef(tv?.running === true && !isTvMode());

  useEffect(() => {
    if (takePartyReturn()) {
      void navigate('/party');
    }
  }, [navigate]);

  const onStart = useCallback(
    async (round: PartyRound) => {
      if (playsOnTvRef.current) {
        return;
      }
      const target = reserveTarget();
      if (target === undefined) {
        return;
      }
      try {
        const song = (await loadSongsByHashes([round.song.file_hash])).at(0);
        if (song === undefined) {
          throw new Error(t('party.host.songMissing'));
        }
        markPartyReturn();
        await launch({ song, queuePlayback: false, players: roundPlayers(round) }, target);
      } catch (error) {
        target?.close();
        toast.error(t('party.host.startFailed', { value1: errorMessage(error) }));
      }
    },
    [launch, playsOnTvRef, reserveTarget],
  );

  useEffect(() => {
    const pending = listen<PartyRound>('party-start', (event) => void onStart(event.payload));
    return () => release(pending);
  }, [onStart]);
};

/** The party screen: opens the lobby and follows it. */
export const usePartyHost = () => {
  const navigate = useNavigate();
  const [opened, setOpened] = useState<PartyOpenResult | null>(null);
  const [view, setView] = useState<PartyView | null>(null);

  useEffect(() => {
    const open = async () => {
      try {
        const result = await openParty();
        setOpened(result);
        setView(result.party);
      } catch (error) {
        toast.error(t('party.host.openFailed', { value1: errorMessage(error) }));
      }
    };
    void open();
    const pending = listen<PartyView>('party-changed', (event) => setView(event.payload));
    return () => release(pending);
  }, []);

  const close = useCallback(async () => {
    await closeParty().catch(() => undefined);
    void navigate('/');
  }, [navigate]);

  return { url: opened?.url ?? null, qrSvg: opened?.qrSvg ?? null, view, close };
};

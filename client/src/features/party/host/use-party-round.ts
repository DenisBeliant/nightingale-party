import { useEffect, useRef } from 'react';

import { abortPartyRound, finishPartyRound, type PartyResult } from '@/bridge/party';
import { listen } from '@/bridge/runtime';
import { partyPlayerId } from '@/features/party/lib/party-pitch-store';
import { markPartyReturn } from '@/features/party/lib/party-return';
import { arcadeTotal } from '@/features/playback/lib/pitch/arcade';
import {
  usePlaybackMicState,
  usePlaybackTransportActions,
  usePlaybackTransportState,
} from '@/features/playback/providers';
import { useLatestRef } from '@/shared/hooks/use-latest-ref';

type MicPlayers = ReturnType<typeof usePlaybackMicState>['players'];

const partyResults = (players: MicPlayers): PartyResult[] =>
  players
    .filter((player) => player.party)
    .map((player) => ({
      playerId: partyPlayerId(player.microphoneId) ?? player.id,
      name: player.profile ?? '',
      score: arcadeTotal(player.gauges),
      pitch: player.gauges.pitch,
      rhythm: player.gauges.rhythm,
      lyrics: player.gauges.lyrics,
    }));

/**
 * Party rounds report their scores when the song ends (the winner becomes
 * game master) and are cancelled if playback is left early, so the phones
 * never stay stuck on "sing".
 */
export const usePartyRound = (): void => {
  const { players } = usePlaybackMicState();
  const { isFinished } = usePlaybackTransportState();
  const party = players.some((player) => player.party);
  const playersRef = useLatestRef(players);
  const partyRef = useLatestRef(party);
  const reported = useRef(false);
  const { handleExit } = usePlaybackTransportActions();

  // The game master stopped the round from their phone: leave playback.
  useEffect(() => {
    if (!party) {
      return undefined;
    }
    const pending = listen('party-stop', () => {
      reported.current = true;
      markPartyReturn();
      handleExit();
    });
    return () => {
      void pending.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [handleExit, party]);

  useEffect(() => {
    if (!party || !isFinished || reported.current) {
      return;
    }
    reported.current = true;
    markPartyReturn();
    void finishPartyRound(partyResults(playersRef.current)).catch(() => undefined);
  }, [isFinished, party, playersRef]);

  useEffect(
    () => () => {
      if (partyRef.current && !reported.current) {
        markPartyReturn();
        void abortPartyRound().catch(() => undefined);
      }
    },
    [partyRef],
  );
};

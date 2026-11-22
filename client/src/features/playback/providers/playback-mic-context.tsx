import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import type { MicCaptureOptions } from '@/bridge/microphone';
import type { PlaybackPlayer } from '@/bridge/playback-session';
import { useMicCapture, useMicPitch } from '@/features/microphone/hooks/use-mic-pitch';
import { useMicReactive, type MicReactiveRef } from '@/features/microphone/hooks/use-mic-reactive';
import { useMicDevices, type MicDevice } from '@/features/microphone/queries/use-mic-devices';
import { partyPlayerId, usePartyPitch } from '@/features/party/lib/party-pitch-store';
import {
  usePitchScoring,
  type PitchScoringSource,
} from '@/features/playback/hooks/use-pitch-scoring';
import { usePlaybackConfigPersist } from '@/features/playback/hooks/use-playback-config-persist';
import type { ArcadeGaugeValues } from '@/features/playback/lib/pitch/arcade';
import { DEFAULT_MIC_LATENCY_COMPENSATION_SEC } from '@/features/playback/lib/pitch/constants';
import type { PitchSeries } from '@/features/playback/lib/pitch/state';
import { t } from '@/i18n';
import { defaultPlayerColor, type PlayerColor } from '@/shared/player-colors';
import type { AppConfig } from '@/types/AppConfig';

import {
  usePlaybackTransportActions,
  usePlaybackTransportState,
} from './playback-transport-context';

export type PlaybackPlayerMicState = {
  id: string;
  profile: string | null;
  microphoneId: string | null;
  color: PlayerColor;
  micName: string;
  pitchScore: number | null;
  rawScore: number;
  series: PitchSeries;
  /** Arcade gauges (pitch, rhythm, lyrics), 0–100. */
  gauges: ArcadeGaugeValues;
  /** Sings into a phone of a multiplayer party rather than a local mic. */
  party: boolean;
  micCaptureActive: boolean;
  micPitchActive: boolean;
  micReady: boolean;
  error: string | null;
};

export type PlaybackMicState = {
  multiplayer: boolean;
  players: PlaybackPlayerMicState[];
  devices: readonly MicDevice[];
  micUserEnabled: boolean;
  micMonitorUserEnabled: boolean;
  selectedMicId: string | null;
  micName: string;
  pitchScore: number | null;
  rawScore: number;
  series: PitchSeries;
  micCaptureActive: boolean;
  micPitchActive: boolean;
  micReady: boolean;
};

export type PlaybackMicActions = {
  reactiveRef: MicReactiveRef;
  handleToggleMic: () => void;
  handleCycleMic: () => void;
  handleToggleMicMonitor: () => void;
  selectMic: (deviceId: string) => void;
};

const EMPTY_PLAYERS: readonly PlaybackPlayer[] = [];
const MicStateContext = createContext<PlaybackMicState | null>(null);
const MicActionsContext = createContext<PlaybackMicActions | null>(null);

type PlaybackMicProviderProps = {
  config: AppConfig | null;
  players?: readonly PlaybackPlayer[];
  children: ReactNode;
};

type MicPlayerConfig = {
  present: boolean;
  id: string;
  profile: string | null;
  microphoneId: string | null;
  color: PlayerColor;
};

type InternalPlayerMicState = PlaybackPlayerMicState & { present: boolean };

type PlayerMicInput = {
  player: MicPlayerConfig;
  captureEnabled: boolean;
  pitchEnabled: boolean;
  emitAudio: boolean;
  source: PitchScoringSource;
  latencySec: number;
};

type CaptureSettings = {
  captureEnabled: boolean;
  pitchEnabled: boolean;
  emitAudio: boolean;
};

const latencyCompensation = (config: AppConfig | null): number =>
  config?.mic_latency_compensation_sec ?? DEFAULT_MIC_LATENCY_COMPENSATION_SEC;

const combineMultiChannel = (config: AppConfig | null, multiplayer: boolean): boolean =>
  multiplayer
    ? (config?.multiplayer_combine_multi_channel ?? true)
    : (config?.combine_multi_channel ?? true);

function playerConfigs(
  players: readonly PlaybackPlayer[],
  selectedMicId: string | null,
): MicPlayerConfig[] {
  if (players.length === 0) {
    return [
      {
        present: true,
        id: 'solo',
        profile: null,
        microphoneId: selectedMicId,
        color: defaultPlayerColor(0),
      },
    ];
  }
  return players.map((player) => ({
    present: true,
    id: player.id,
    profile: player.profile,
    microphoneId: player.microphoneId,
    color: player.color,
  }));
}

function playerAt(players: readonly MicPlayerConfig[], index: number): MicPlayerConfig {
  const player = players.at(index);
  if (player !== undefined) {
    return player;
  }
  return {
    present: false,
    id: `inactive-${index + 1}`,
    profile: null,
    microphoneId: null,
    color: defaultPlayerColor(index),
  };
}

function captureSettings(
  multiplayer: boolean,
  playbackActive: boolean,
  micUserEnabled: boolean,
  micMonitorUserEnabled: boolean,
): CaptureSettings {
  if (multiplayer) {
    return {
      captureEnabled: playbackActive || micMonitorUserEnabled,
      pitchEnabled: playbackActive,
      emitAudio: playbackActive && micMonitorUserEnabled,
    };
  }
  const pitchEnabled = playbackActive && micUserEnabled;
  return {
    captureEnabled: pitchEnabled || micMonitorUserEnabled,
    pitchEnabled,
    emitAudio: playbackActive && micMonitorUserEnabled,
  };
}

/** Local microphone, or the phone of a party player (`party:<id>`). */
function usePlayerPitch(
  player: MicPlayerConfig,
  shouldCapture: boolean,
  shouldTrackPitch: boolean,
  captureOptions: MicCaptureOptions,
) {
  const partyId = partyPlayerId(player.microphoneId);
  const local = partyId === null;
  const capture = useMicCapture({
    captureId: player.id,
    deviceId: local ? player.microphoneId : null,
    enabled: shouldCapture && local,
    options: captureOptions,
  });
  const pitch = useMicPitch(player.id, shouldTrackPitch && local);
  const remotePitch = usePartyPitch(partyId, shouldTrackPitch);
  if (!local) {
    return {
      party: true,
      latestPitch: remotePitch,
      captureActive: shouldTrackPitch,
      pitchActive: shouldTrackPitch,
      error: null,
    };
  }
  return {
    party: false,
    latestPitch: pitch.latestPitch,
    captureActive: capture.active,
    pitchActive: pitch.active,
    error: capture.error ?? pitch.error,
  };
}

function usePlayerMic({
  player,
  captureEnabled,
  pitchEnabled,
  emitAudio,
  source,
  latencySec,
}: PlayerMicInput): InternalPlayerMicState {
  const shouldCapture = captureEnabled && player.present;
  const shouldTrackPitch = pitchEnabled && player.present;
  const captureOptions = useMemo(() => ({ emit_audio: emitAudio }), [emitAudio]);
  const mic = usePlayerPitch(player, shouldCapture, shouldTrackPitch, captureOptions);
  const micCaptureActive = mic.captureActive;
  const micPitchActive = mic.pitchActive;
  const { series, score, gauges } = usePitchScoring(
    { ...source, isReady: source.isReady && player.present },
    mic.latestPitch,
    latencySec,
  );
  const micReady = micCaptureActive && micPitchActive;

  return {
    ...player,
    micName: '',
    pitchScore: micReady ? score : null,
    rawScore: score,
    series,
    gauges,
    party: mic.party,
    micCaptureActive,
    micPitchActive,
    micReady,
    error: mic.error,
  };
}

function namePlayer(player: InternalPlayerMicState, devices: readonly MicDevice[]) {
  const device = devices.find((candidate) => candidate.deviceId === player.microphoneId);
  return {
    id: player.id,
    profile: player.profile,
    microphoneId: player.microphoneId,
    color: player.color,
    micName: player.party
      ? t('party.hud.phone')
      : (device?.label ?? player.microphoneId ?? t('settings.microphone.default')),
    pitchScore: player.pitchScore,
    rawScore: player.rawScore,
    series: player.series,
    gauges: player.gauges,
    party: player.party,
    micCaptureActive: player.micCaptureActive,
    micPitchActive: player.micPitchActive,
    micReady: player.micReady,
    error: player.error,
  } satisfies PlaybackPlayerMicState;
}

function errorPrefix(multiplayer: boolean, index: number): string {
  return multiplayer
    ? t('playback.players.playerNumber', { number: index + 1 })
    : t('settings.microphone.label');
}

type MicStateInput = {
  multiplayer: boolean;
  players: PlaybackPlayerMicState[];
  devices: readonly MicDevice[];
  primary: PlaybackPlayerMicState;
  micUserEnabled: boolean;
  micMonitorUserEnabled: boolean;
};

function micState(input: MicStateInput): PlaybackMicState {
  const { multiplayer, players, primary } = input;
  if (multiplayer) {
    return {
      multiplayer,
      players,
      devices: input.devices,
      micUserEnabled: true,
      micMonitorUserEnabled: input.micMonitorUserEnabled,
      selectedMicId: primary.microphoneId,
      micName: primary.micName,
      pitchScore: primary.pitchScore,
      rawScore: primary.rawScore,
      series: primary.series,
      micCaptureActive: primary.micCaptureActive,
      micPitchActive: primary.micPitchActive,
      micReady: primary.micReady,
    };
  }
  return {
    multiplayer,
    players,
    devices: input.devices,
    micUserEnabled: input.micUserEnabled,
    micMonitorUserEnabled: input.micMonitorUserEnabled,
    selectedMicId: primary.microphoneId,
    micName: primary.micName,
    pitchScore: primary.pitchScore,
    rawScore: primary.rawScore,
    series: primary.series,
    micCaptureActive: primary.micCaptureActive,
    micPitchActive: primary.micPitchActive,
    micReady: primary.micReady,
  };
}

export function PlaybackMicProvider({ config, players, children }: PlaybackMicProviderProps) {
  const sessionPlayers = players ?? EMPTY_PLAYERS;
  const { isReady, isPlaying, paused, duration } = usePlaybackTransportState();
  const { subscribe, getScoringBuffer } = usePlaybackTransportActions();
  const persistConfig = usePlaybackConfigPersist(config);
  const multiplayer = sessionPlayers.length > 0;
  const [micUserEnabled, setMicUserEnabled] = useState(config?.mic_active ?? true);
  const [micMonitorUserEnabled, setMicMonitorUserEnabled] = useState(
    config?.mic_monitoring ?? false,
  );
  const [selectedMicId, setSelectedMicId] = useState<string | null>(config?.preferred_mic ?? null);
  const micDevices = useMicDevices(undefined, combineMultiChannel(config, multiplayer));
  const settings = captureSettings(
    multiplayer,
    isReady && isPlaying && !paused,
    micUserEnabled,
    micMonitorUserEnabled,
  );
  const source = useMemo<PitchScoringSource>(
    () => ({ isReady, duration, getReferenceBuffer: getScoringBuffer, subscribe }),
    [duration, getScoringBuffer, isReady, subscribe],
  );
  const configs = playerConfigs(sessionPlayers, selectedMicId);
  const latencySec = latencyCompensation(config);
  const playerInput = (index: number): PlayerMicInput => ({
    player: playerAt(configs, index),
    ...settings,
    source,
    latencySec,
  });
  const slotOne = usePlayerMic(playerInput(0));
  const slotTwo = usePlayerMic(playerInput(1));
  const slotThree = usePlayerMic(playerInput(2));
  const slotFour = usePlayerMic(playerInput(3));
  const namedPlayers = [slotOne, slotTwo, slotThree, slotFour]
    .filter((player) => player.present)
    .map((player) => namePlayer(player, micDevices));
  const primary = namedPlayers[0];
  const reactiveRef = useMicReactive([
    { captureId: slotOne.id, enabled: slotOne.micReady },
    { captureId: slotTwo.id, enabled: slotTwo.micReady },
    { captureId: slotThree.id, enabled: slotThree.micReady },
    { captureId: slotFour.id, enabled: slotFour.micReady },
  ]);

  const shownErrors = useRef(new Set<string>());
  useEffect(() => {
    for (const [index, player] of namedPlayers.entries()) {
      if (player.error === null) {
        shownErrors.current.delete(player.id);
        continue;
      }
      if (!shownErrors.current.has(player.id)) {
        shownErrors.current.add(player.id);
        toast.error(
          t('playback.playbackMicContext.message', {
            value1: errorPrefix(multiplayer, index),
            value2: player.error,
          }),
        );
      }
    }
  }, [multiplayer, namedPlayers]);

  const handleToggleMic = useCallback(() => {
    if (multiplayer) {
      return;
    }
    setMicUserEnabled((previous) => {
      const next = !previous;
      if (!next && micMonitorUserEnabled) {
        setMicMonitorUserEnabled(false);
        persistConfig({ mic_active: false, mic_monitoring: false });
      } else {
        persistConfig({ mic_active: next });
      }
      return next;
    });
  }, [micMonitorUserEnabled, multiplayer, persistConfig]);

  const selectMic = useCallback(
    (deviceId: string) => {
      if (multiplayer || !micDevices.some((device) => device.deviceId === deviceId)) {
        return;
      }
      setSelectedMicId(deviceId);
      persistConfig({ preferred_mic: deviceId });
    },
    [micDevices, multiplayer, persistConfig],
  );

  const handleCycleMic = useCallback(() => {
    if (multiplayer || micDevices.length <= 1) {
      return;
    }
    const currentIndex = micDevices.findIndex((device) => device.deviceId === selectedMicId);
    const next = micDevices[(currentIndex + 1) % micDevices.length];
    selectMic(next.deviceId);
  }, [micDevices, multiplayer, selectMic, selectedMicId]);

  const handleToggleMicMonitor = useCallback(() => {
    setMicMonitorUserEnabled((previous) => {
      const next = !previous;
      persistConfig({ mic_monitoring: next });
      if (!multiplayer && next && !micUserEnabled) {
        setMicUserEnabled(true);
        persistConfig({ mic_active: true });
      }
      return next;
    });
  }, [micUserEnabled, multiplayer, persistConfig]);

  const stateValue = useMemo(
    () =>
      micState({
        multiplayer,
        players: namedPlayers,
        devices: micDevices,
        primary,
        micUserEnabled,
        micMonitorUserEnabled,
      }),
    [micDevices, micMonitorUserEnabled, micUserEnabled, multiplayer, namedPlayers, primary],
  );
  const actionsValue = useMemo<PlaybackMicActions>(
    () => ({ reactiveRef, handleToggleMic, handleCycleMic, handleToggleMicMonitor, selectMic }),
    [handleCycleMic, handleToggleMic, handleToggleMicMonitor, reactiveRef, selectMic],
  );

  return (
    <MicStateContext.Provider value={stateValue}>
      <MicActionsContext.Provider value={actionsValue}>{children}</MicActionsContext.Provider>
    </MicStateContext.Provider>
  );
}

export function usePlaybackMicState(): PlaybackMicState {
  const context = useContext(MicStateContext);
  if (!context) {
    throw new Error('usePlaybackMicState must be used within a PlaybackMicProvider');
  }
  return context;
}

export function usePlaybackMicActions(): PlaybackMicActions {
  const context = useContext(MicActionsContext);
  if (!context) {
    throw new Error('usePlaybackMicActions must be used within a PlaybackMicProvider');
  }
  return context;
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { themeKey } from '@/features/playback/components/theme';

import {
  PlaybackStartupActionsContext,
  PlaybackStartupStateContext,
  type PlaybackStartupActions,
  type PlaybackStartupState,
} from './playback-startup-context';
import { usePlaybackThemeState } from './playback-theme-context';
import { usePlaybackTranscriptState } from './playback-transcript-context';
import {
  usePlaybackTransportActions,
  usePlaybackTransportState,
} from './playback-transport-context';

/**
 * Waits for audio, lyrics and background, then starts the song; a party round
 * first counts down (3, 2, 1) so the singers are ready.
 */
export function PlaybackStartupProvider({
  countdownSeconds = 0,
  children,
}: {
  countdownSeconds?: number;
  children: ReactNode;
}) {
  const { isReady: audioReady } = usePlaybackTransportState();
  const { startPlayback } = usePlaybackTransportActions();
  const { isReady: transcriptReady } = usePlaybackTranscriptState();
  const { theme } = usePlaybackThemeState();
  const activeThemeKey = themeKey(theme);
  const [readyBackgroundKey, setReadyBackgroundKey] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const markBackgroundReady = useCallback((key: string) => {
    setReadyBackgroundKey(key);
  }, []);

  useEffect(() => {
    if (!audioReady || !transcriptReady || readyBackgroundKey !== activeThemeKey || started) {
      return undefined;
    }

    let paintFrame = 0;
    const commitFrame = requestAnimationFrame(() => {
      paintFrame = requestAnimationFrame(() => {
        setCountdown(countdownSeconds > 0 ? countdownSeconds : null);
        setStarted(true);
      });
    });

    return () => {
      cancelAnimationFrame(commitFrame);
      cancelAnimationFrame(paintFrame);
    };
  }, [activeThemeKey, audioReady, countdownSeconds, readyBackgroundKey, started, transcriptReady]);

  useEffect(() => {
    if (!started) {
      return undefined;
    }
    if (countdown !== null) {
      const tick = window.setTimeout(
        () => setCountdown((left) => (left !== null && left > 1 ? left - 1 : null)),
        1000,
      );
      return () => window.clearTimeout(tick);
    }

    const playbackFrame = requestAnimationFrame(startPlayback);
    return () => cancelAnimationFrame(playbackFrame);
  }, [countdown, startPlayback, started]);

  const stateValue = useMemo<PlaybackStartupState>(
    () => ({ started, countdown }),
    [countdown, started],
  );
  const actionsValue = useMemo<PlaybackStartupActions>(
    () => ({ markBackgroundReady }),
    [markBackgroundReady],
  );

  return (
    <PlaybackStartupStateContext.Provider value={stateValue}>
      <PlaybackStartupActionsContext.Provider value={actionsValue}>
        {children}
      </PlaybackStartupActionsContext.Provider>
    </PlaybackStartupStateContext.Provider>
  );
}

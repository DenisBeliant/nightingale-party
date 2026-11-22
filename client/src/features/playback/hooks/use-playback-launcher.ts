import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import {
  reservePlaybackTarget,
  savePlaybackSession,
  showPlaybackTarget,
  type PlaybackSession,
  type PlaybackTarget,
} from '@/bridge/playback-session';
import { t } from '@/i18n';
import { useConfig } from '@/shared/config/use-config';
import { isTvMode } from '@/shared/tv-mode';

export function usePlaybackLauncher() {
  const navigate = useNavigate();
  const { data: config } = useConfig();
  // A TV browser opens the separate playback window as a tab its Back button
  // cannot leave: on a TV, playback always stays in the page.
  const sessionMode = config?.playback_mode === 'session' && !isTvMode();

  const reserveTarget = useCallback((): PlaybackTarget => {
    const target = sessionMode ? reservePlaybackTarget() : null;
    if (target === undefined) {
      toast.error(t('playback.hooks.usePlaybackLauncher.allowPopUpsToOpenDescription'));
    }
    return target;
  }, [sessionMode]);

  const launch = useCallback(
    async (session: PlaybackSession, target: PlaybackTarget): Promise<void> => {
      try {
        if (!sessionMode) {
          await navigate('/playback', { replace: session.queuePlayback, state: session });
          return;
        }

        await savePlaybackSession(session);
        await showPlaybackTarget(target);
      } catch (error) {
        target?.close();
        toast.error(
          t('playback.usePlaybackLauncher.couldNotStartPlayback', {
            value1: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
    [navigate, sessionMode],
  );

  return { launch, reserveTarget, sessionMode };
}

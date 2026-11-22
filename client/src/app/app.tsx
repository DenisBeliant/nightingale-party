import './app.css';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';

import { UPDATES_SUPPORTED } from '@/bridge/platform';
import { loadInterfaceLanguage } from '@/bridge/remote-control';
import { LibraryPage } from '@/features/library/library-page';
import { MenuLayout } from '@/features/menu/menu';
import { MenuFocusProvider } from '@/features/menu/providers/menu-focus-context';
import { PartyHostPage } from '@/features/party/host/party-host-page';
import { ToParty, TvPartyLayout } from '@/features/party/host/tv-party-layout';
import { PartyPhonePage } from '@/features/party/phone/party-phone-page';
import { PlayPage } from '@/features/party/play/play-page';
import { Playback } from '@/features/playback/playback';
import { PlaylistsPage } from '@/features/playlists/playlists-page';
import { RemoteQueuePage } from '@/features/remote/remote-queue';
import { SettingsPage } from '@/features/settings/settings';
import { useUpdate } from '@/features/updates/queries/use-update';
import { syncLanguagePreference, useTranslation } from '@/i18n';
import { Toaster } from '@/shared/components/ui/sonner';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { TauriAppShell } from '@/shared/components/window/title-bar';
import { useConfig } from '@/shared/config/use-config';
import { REMOTE_LANGUAGE } from '@/shared/query-keys';
import { isTvMode } from '@/shared/tv-mode';

import { NavInputProvider } from './providers/nav-input-context';
import { ThemeProvider } from './providers/theme-context';

const queryClient = new QueryClient();

/**
 * The phone page skips the desktop shell: it has no host config, no window
 * chrome, and no business loading library or playback state.
 */
/** Ports of the desktop app's phone surfaces: LAN remote (HTTP) and party (HTTPS). */
const PHONE_PORTS = new Set(['64449', '64450']);

/**
 * Phone pages: the queue remote, and the party page when a phone opened it
 * (party port, or the pairing token of its QR link). On the host — desktop
 * window or a TV browser on the self-hosted server — `/party` is the host screen.
 */
const isRemoteSurface = (): boolean => {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/q') {
    return true;
  }
  return (
    path === '/party' &&
    (PHONE_PORTS.has(window.location.port) || new URLSearchParams(window.location.search).has('t'))
  );
};

const UpdateAutoCheck = () => {
  useUpdate();

  return null;
};

/** Desktop and browser: the full app around the menu. */
const menuRoutes = (
  <Route path="/" element={<MenuLayout />}>
    <Route index element={<LibraryPage />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="playlists" element={<PlaylistsPage />} />
    <Route path="party" element={<PartyHostPage />} />
    <Route path="play" element={<PlayPage />} />
  </Route>
);

/** TV: the party screen only (and playback); every other page leads there. */
const tvRoutes = (
  <Route path="/" element={<TvPartyLayout />}>
    <Route index element={<ToParty />} />
    <Route path="party" element={<PartyHostPage />} />
    <Route path="*" element={<ToParty />} />
  </Route>
);

const InnerWrapper = () => (
  <>
    <MenuFocusProvider>
      <BrowserRouter>
        <Routes>
          {isTvMode() ? tvRoutes : menuRoutes}
          <Route path="/playback" element={<Playback />} />
        </Routes>
      </BrowserRouter>
    </MenuFocusProvider>
    <Toaster />
    {UPDATES_SUPPORTED && <UpdateAutoCheck />}
  </>
);

/**
 * The phone is served by the LAN router, so it never receives the host's
 * bootstrap payload. Ask for the interface language so the remote reads the
 * same language the host selected.
 */
const RemoteLanguageSync = () => {
  const { data } = useQuery({
    queryKey: REMOTE_LANGUAGE,
    queryFn: loadInterfaceLanguage,
    retry: false,
  });

  useEffect(() => {
    if (data !== undefined) {
      syncLanguagePreference(data);
    }
  }, [data]);

  return null;
};

const RemoteShell = () => (
  <ThemeProvider defaultTheme="dark">
    <RemoteLanguageSync />
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/q" element={<RemoteQueuePage />} />
          <Route path="/party" element={<PartyPhonePage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  </ThemeProvider>
);

const ThemeWrapper = () => {
  const { data: config } = useConfig();

  useEffect(() => {
    if (config !== undefined) {
      syncLanguagePreference(config.language);
    }
  }, [config]);

  return (
    <ThemeProvider defaultTheme={config?.dark_mode === false ? 'light' : 'dark'}>
      <TooltipProvider>
        <TauriAppShell>
          <InnerWrapper />
        </TauriAppShell>
      </TooltipProvider>
    </ThemeProvider>
  );
};

export const App = () => {
  useTranslation();

  return (
    <NavInputProvider>
      <QueryClientProvider client={queryClient}>
        {isRemoteSurface() ? <RemoteShell /> : <ThemeWrapper />}
      </QueryClientProvider>
    </NavInputProvider>
  );
};

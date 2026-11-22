import { invoke, isTauri, listen } from './runtime';

/** "Play on the TV": the desktop serves the app on the LAN for the Nightingale TV app. */
export type TvServerStatus = {
  running: boolean;
  /** Name the TV lists this computer under. */
  name: string;
  /** `http://<lan-ip>:<port>`, to type on the TV if discovery is blocked. */
  url: string | null;
  error: string | null;
};

const IDLE: TvServerStatus = { running: false, name: '', url: null, error: null };

/** Desktop only: the self-hosted server and the TV itself have nothing to start. */
export const tvServerAvailable = isTauri;

export const loadTvServerStatus = async (): Promise<TvServerStatus> =>
  tvServerAvailable ? await invoke<TvServerStatus>('tv_server_status') : IDLE;

export const startTvServer = async (): Promise<TvServerStatus> =>
  await invoke<TvServerStatus>('tv_server_start');

export const stopTvServer = async (): Promise<TvServerStatus> =>
  tvServerAvailable ? await invoke<TvServerStatus>('tv_server_stop') : IDLE;

export const onTvServerChanged = (callback: (status: TvServerStatus) => void) =>
  listen<TvServerStatus>('tv-server-changed', (event) => callback(event.payload));

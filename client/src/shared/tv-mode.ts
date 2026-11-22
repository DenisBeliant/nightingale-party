/**
 * "TV mode": a TV browser reports a small CSS viewport (often 960×540 on a
 * 4K screen), so the desktop sizes in `rem` look twice as big and the
 * playback layers run into each other. In TV mode the root font size follows
 * the viewport instead, so the screen is laid out like a 1920×1080 desktop.
 *
 * `?tv=1` turns it on for this browser (remembered), `?tv=0` turns it off;
 * otherwise TV browsers are recognised by their user agent.
 */

const STORAGE_KEY = 'nightingale.tv';

const TV_USER_AGENT =
  /\b(nightingaletv|android ?tv|google ?tv|googletv|aft[a-z0-9]*|bravia|smart-?tv|tizen|web0s|webos|crkey)\b/i;

const storedChoice = (): boolean | null => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === null ? null : value === '1';
  } catch {
    return null;
  }
};

const rememberChoice = (on: boolean): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Storage unavailable: the URL flag still applies to this visit.
  }
};

const urlChoice = (): boolean | null => {
  const value = new URLSearchParams(window.location.search).get('tv');
  if (value === null) {
    return null;
  }
  const on = value !== '0';
  rememberChoice(on);
  return on;
};

/** A TV has no touch screen; Android TV browsers do not always say "TV". */
const looksLikeTv = (): boolean => {
  const agent = navigator.userAgent;
  if (TV_USER_AGENT.test(agent)) {
    return true;
  }
  return /android/i.test(agent) && !/mobile/i.test(agent) && navigator.maxTouchPoints === 0;
};

export const isTvMode = (): boolean => urlChoice() ?? storedChoice() ?? looksLikeTv();

/** Marks `<html>` with the `tv` class read by `app.css`. Call once at startup. */
export const applyTvMode = (): void => {
  document.documentElement.classList.toggle('tv', isTvMode());
};

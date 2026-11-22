const KEY = 'nightingale.party.secret';

/** The phone's player secret survives reloads; storage can be unavailable. */
export const loadPartySecret = (): string | null => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const savePartySecret = (secret: string | null): void => {
  try {
    if (secret === null) {
      window.localStorage.removeItem(KEY);
    } else {
      window.localStorage.setItem(KEY, secret);
    }
  } catch {
    // Private mode: the player simply rejoins after a reload.
  }
};

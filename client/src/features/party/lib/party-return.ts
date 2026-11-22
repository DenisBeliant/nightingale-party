const KEY = 'nightingale.party.return';

/** After a party round, the menu window goes back to the party screen. */
export const markPartyReturn = (): void => {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Storage unavailable: the host opens the party screen by hand.
  }
};

export const takePartyReturn = (): boolean => {
  try {
    const pending = window.localStorage.getItem(KEY) === '1';
    window.localStorage.removeItem(KEY);
    return pending;
  } catch {
    return false;
  }
};

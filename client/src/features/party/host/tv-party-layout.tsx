import { Navigate, Outlet } from 'react-router';

import { usePartyHostListener } from './use-party-host';

/**
 * On a TV, Nightingale is only the party: no library, settings or sidebar.
 * This layout keeps the party listener (it starts playback when the game
 * master launches a round) around the party screen.
 */
export const TvPartyLayout = () => {
  usePartyHostListener();
  return <Outlet />;
};

/** Any other page on a TV goes to the party screen. */
export const ToParty = () => <Navigate to="/party" replace />;

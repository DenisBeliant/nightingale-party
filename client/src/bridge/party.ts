import type { PartyGenre } from '@/types/PartyGenre';
import type { PartySong } from '@/types/PartySong';

import { invoke } from './runtime';

// Mirrors `app-api/src/party.rs` (camelCase over the wire).

export type PartyPhase = 'lobby' | 'playing' | 'results';
export type PartyPickMode = 'song' | 'genre' | 'random';
export type PartyColor = 'rose' | 'fuchsia' | 'amber' | 'emerald';

export type PartyPlayer = {
  id: string;
  name: string;
  master: boolean;
  color: PartyColor;
};

export type PartySelection = {
  mode: PartyPickMode;
  fileHash: string | null;
  genre: string | null;
  label: string;
};

export type PartyResult = {
  playerId: string;
  name: string;
  score: number;
  pitch: number;
  rhythm: number;
  lyrics: number;
};

export type PartyView = {
  open: boolean;
  phase: PartyPhase;
  players: PartyPlayer[];
  selection: PartySelection | null;
  currentSong: PartySong | null;
  results: PartyResult[];
  round: number;
  minPlayers: number;
  maxPlayers: number;
};

export type PartyPhoneView = {
  party: PartyView;
  me: PartyPlayer | null;
};

export type PartyRound = {
  song: PartySong;
  players: PartyPlayer[];
  round: number;
};

export type PartyPitch = {
  playerId: string;
  hz: number | null;
};

export type PartyOpenResult = {
  url: string | null;
  qrSvg: string | null;
  party: PartyView;
};

export type PartyPickRequest = {
  mode: PartyPickMode;
  fileHash?: string;
  genre?: string;
};

// ── Host (desktop window) ───────────────────────────────────────────────

export const openParty = async (): Promise<PartyOpenResult> =>
  await invoke<PartyOpenResult>('party_open');

export const closeParty = async (): Promise<PartyView> => await invoke<PartyView>('party_close');

export const loadParty = async (): Promise<PartyView> => await invoke<PartyView>('party_view');

export const finishPartyRound = async (results: PartyResult[]): Promise<PartyView> =>
  await invoke<PartyView>('party_finish', { results });

export const abortPartyRound = async (): Promise<PartyView> =>
  await invoke<PartyView>('party_abort');

// ── Phone ───────────────────────────────────────────────────────────────

export const joinParty = async (
  name: string,
  secret: string | null,
): Promise<{ secret: string; view: PartyPhoneView }> =>
  await invoke<{ secret: string; view: PartyPhoneView }>('party_join', { name, secret });

export const loadPartyMe = async (secret: string): Promise<PartyPhoneView> =>
  await invoke<PartyPhoneView>('party_me', { secret });

export const leaveParty = async (secret: string): Promise<void> => {
  await invoke('party_leave', { secret });
};

export const loadPartySongs = async (): Promise<PartySong[]> =>
  await invoke<PartySong[]>('party_songs');

export const loadPartyGenres = async (): Promise<PartyGenre[]> =>
  await invoke<PartyGenre[]>('party_genres');

export const pickPartySong = async (
  secret: string,
  request: PartyPickRequest,
): Promise<PartyView> => await invoke<PartyView>('party_pick', { secret, ...request });

export const startPartyRound = async (secret: string): Promise<PartyView> =>
  await invoke<PartyView>('party_start', { secret });

/** The game master stops the round that is playing (no scores). */
export const stopPartyRound = async (secret: string): Promise<PartyView> =>
  await invoke<PartyView>('party_stop', { secret });

export const sendPartyPitch = async (secret: string, hz: number | null): Promise<void> => {
  await invoke('party_pitch', { secret, hz });
};

//! Multiplayer party: phones join by QR code, the game master picks what
//! plays next, everyone sings together into their own phone, and the winner
//! becomes the next game master.
//!
//! The party lives in the shared command state so the desktop window (Tauri
//! IPC) and the phones (LAN HTTP) see one source of truth. Phones identify
//! with a secret handed out at join time; player ids are public.

use std::sync::{Mutex, PoisonError};

use app_core::PartySong;
use serde::{Deserialize, Serialize};

pub(crate) const MIN_PLAYERS: usize = 1;
/// Matches the four singer slots of the playback screen.
pub(crate) const MAX_PLAYERS: usize = 4;
const NAME_MAX_CHARS: usize = 20;
const COLORS: [&str; MAX_PLAYERS] = ["rose", "fuchsia", "amber", "emerald"];

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum PartyPhase {
    #[default]
    Lobby,
    Playing,
    Results,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum PartyPickMode {
    /// A specific song.
    Song,
    /// A random song of a genre.
    Genre,
    /// Any random song.
    Random,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PartySelection {
    pub(crate) mode: PartyPickMode,
    pub(crate) file_hash: Option<String>,
    pub(crate) genre: Option<String>,
    /// Shown to everyone: "Artist – Title", the genre, or empty for random.
    pub(crate) label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PartyResult {
    pub(crate) player_id: String,
    pub(crate) name: String,
    /// Overall score, 0–100.
    pub(crate) score: u32,
    /// Gauges, 0–100.
    pub(crate) pitch: u32,
    pub(crate) rhythm: u32,
    pub(crate) lyrics: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PartyPlayerView {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) master: bool,
    pub(crate) color: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PartyView {
    pub(crate) open: bool,
    pub(crate) phase: PartyPhase,
    pub(crate) players: Vec<PartyPlayerView>,
    pub(crate) selection: Option<PartySelection>,
    pub(crate) current_song: Option<PartySong>,
    pub(crate) results: Vec<PartyResult>,
    pub(crate) round: u32,
    pub(crate) min_players: usize,
    pub(crate) max_players: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PhoneView {
    pub(crate) party: PartyView,
    /// `None` when the secret is unknown (party reset, removed player).
    pub(crate) me: Option<PartyPlayerView>,
}

/// What the playback screen needs to start a round.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PartyRound {
    pub(crate) song: PartySong,
    pub(crate) players: Vec<PartyPlayerView>,
    pub(crate) round: u32,
}

struct Player {
    id: String,
    secret: String,
    name: String,
}

#[derive(Default)]
struct Party {
    open: bool,
    phase: PartyPhase,
    players: Vec<Player>,
    master_id: Option<String>,
    selection: Option<PartySelection>,
    current: Option<PartySong>,
    results: Vec<PartyResult>,
    round: u32,
}

impl Party {
    fn player_view(&self, index: usize, player: &Player) -> PartyPlayerView {
        PartyPlayerView {
            id: player.id.clone(),
            name: player.name.clone(),
            master: self.master_id.as_deref() == Some(player.id.as_str()),
            color: COLORS.get(index).copied().unwrap_or("rose"),
        }
    }

    fn view(&self) -> PartyView {
        PartyView {
            open: self.open,
            phase: self.phase,
            players: self
                .players
                .iter()
                .enumerate()
                .map(|(index, player)| self.player_view(index, player))
                .collect(),
            selection: self.selection.clone(),
            current_song: self.current.clone(),
            results: self.results.clone(),
            round: self.round,
            min_players: MIN_PLAYERS,
            max_players: MAX_PLAYERS,
        }
    }

    fn me(&self, secret: &str) -> Option<PartyPlayerView> {
        self.players
            .iter()
            .enumerate()
            .find(|(_, player)| player.secret == secret)
            .map(|(index, player)| self.player_view(index, player))
    }

    fn phone_view(&self, secret: &str) -> PhoneView {
        PhoneView {
            party: self.view(),
            me: self.me(secret),
        }
    }

    fn require_master(&self, secret: &str) -> Result<(), String> {
        match self.me(secret) {
            Some(me) if me.master => Ok(()),
            Some(_) => Err("only the game master can do this".into()),
            None => Err("you are not in this party".into()),
        }
    }
}

#[derive(Default)]
pub(crate) struct PartyStore {
    inner: Mutex<Party>,
}

/// What the game master asked for, before it is resolved to a song.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PickRequest {
    pub(crate) mode: PartyPickMode,
    #[serde(default)]
    pub(crate) file_hash: Option<String>,
    #[serde(default)]
    pub(crate) genre: Option<String>,
}

fn clean_name(raw: &str) -> Result<String, String> {
    let name: String = raw
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .filter(|character| !character.is_control())
        .take(NAME_MAX_CHARS)
        .collect();
    if name.is_empty() {
        Err("choose a nickname".into())
    } else {
        Ok(name)
    }
}

/// Playback needs distinct names: a second "Alex" becomes "Alex 2".
fn unique_name(players: &[Player], name: String, secret: Option<&str>) -> String {
    let taken = |candidate: &str| {
        players
            .iter()
            .any(|player| Some(player.secret.as_str()) != secret && player.name == candidate)
    };
    if !taken(&name) {
        return name;
    }
    let free = (2..)
        .map(|suffix| format!("{name} {suffix}"))
        .find(|candidate| !taken(candidate));
    free.unwrap_or(name)
}

impl PartyStore {
    fn lock(&self) -> std::sync::MutexGuard<'_, Party> {
        self.inner.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub(crate) fn view(&self) -> PartyView {
        self.lock().view()
    }

    pub(crate) fn phone_view(&self, secret: &str) -> PhoneView {
        self.lock().phone_view(secret)
    }

    /// Open the lobby. An already open party keeps its players.
    pub(crate) fn open(&self) -> PartyView {
        let mut party = self.lock();
        party.open = true;
        party.view()
    }

    pub(crate) fn close(&self) -> PartyView {
        let mut party = self.lock();
        *party = Party::default();
        party.view()
    }

    /// Join, or rejoin with a known `secret` (page reload). The first player
    /// becomes the game master. Returns the player's secret.
    pub(crate) fn join(
        &self,
        name: &str,
        secret: Option<&str>,
    ) -> Result<(String, PhoneView), String> {
        let name = clean_name(name)?;
        let mut party = self.lock();
        if !party.open {
            return Err("there is no party open on this screen".into());
        }
        if let Some(secret) = secret.filter(|secret| !secret.is_empty())
            && party.players.iter().any(|p| p.secret == secret)
        {
            let name = unique_name(&party.players, name, Some(secret));
            let Some(player) = party.players.iter_mut().find(|p| p.secret == secret) else {
                return Err("you are not in this party".into());
            };
            player.name = name;
            let secret = player.secret.clone();
            let view = party.phone_view(&secret);
            return Ok((secret, view));
        }
        if party.players.len() >= MAX_PLAYERS {
            return Err("the party is full".into());
        }
        let player = Player {
            id: app_core::party_token(),
            secret: app_core::party_token(),
            name: unique_name(&party.players, name, None),
        };
        if party.master_id.is_none() {
            party.master_id = Some(player.id.clone());
        }
        let secret = player.secret.clone();
        party.players.push(player);
        let view = party.phone_view(&secret);
        Ok((secret, view))
    }

    pub(crate) fn leave(&self, secret: &str) -> PartyView {
        let mut party = self.lock();
        let leaving = party
            .players
            .iter()
            .position(|player| player.secret == secret);
        if let Some(index) = leaving {
            let removed = party.players.remove(index);
            if party.master_id.as_deref() == Some(removed.id.as_str()) {
                party.master_id = party.players.first().map(|player| player.id.clone());
            }
        }
        party.view()
    }

    /// The game master chooses what plays next. Resolving a song touches the
    /// library, so this runs on a blocking thread.
    pub(crate) fn pick(&self, secret: &str, request: PickRequest) -> Result<PartyView, String> {
        {
            let party = self.lock();
            party.require_master(secret)?;
            if party.phase == PartyPhase::Playing {
                return Err("a song is already playing".into());
            }
        }
        let selection = resolve_selection(request)?;
        let mut party = self.lock();
        party.require_master(secret)?;
        party.selection = Some(selection);
        Ok(party.view())
    }

    /// The game master starts the round. Returns what the host must play.
    pub(crate) fn start(&self, secret: &str) -> Result<(PartyView, PartyRound), String> {
        let (selection, previous) = {
            let party = self.lock();
            party.require_master(secret)?;
            if party.phase == PartyPhase::Playing {
                return Err("a song is already playing".into());
            }
            if party.players.len() < MIN_PLAYERS {
                return Err(format!("at least {MIN_PLAYERS} players are needed"));
            }
            let selection = party
                .selection
                .clone()
                .ok_or_else(|| "choose what to play first".to_string())?;
            (
                selection,
                party.current.as_ref().map(|song| song.file_hash.clone()),
            )
        };

        let song = resolve_song(&selection, previous.as_deref())?;
        let mut party = self.lock();
        party.require_master(secret)?;
        party.phase = PartyPhase::Playing;
        party.current = Some(song.clone());
        party.results.clear();
        party.round = party.round.saturating_add(1);
        let view = party.view();
        let round = PartyRound {
            song,
            players: view.players.clone(),
            round: party.round,
        };
        Ok((view, round))
    }

    /// A phone's live pitch. Returns the player id while a round plays.
    pub(crate) fn pitch_player(&self, secret: &str) -> Option<String> {
        let party = self.lock();
        if party.phase != PartyPhase::Playing {
            return None;
        }
        party
            .players
            .iter()
            .find(|player| player.secret == secret)
            .map(|player| player.id.clone())
    }

    /// The host reports the round's scores: the winner becomes game master
    /// and picks the next song.
    pub(crate) fn finish(&self, mut results: Vec<PartyResult>) -> PartyView {
        let mut party = self.lock();
        results.retain(|result| party.players.iter().any(|p| p.id == result.player_id));
        results.sort_by(|a, b| b.score.cmp(&a.score));
        if let Some(winner) = results.first() {
            party.master_id = Some(winner.player_id.clone());
        }
        party.results = results;
        party.selection = None;
        party.phase = PartyPhase::Results;
        party.view()
    }

    /// The game master stops the round from their phone: back to the lobby,
    /// no scores. The host leaves playback on the `party-stop` event.
    pub(crate) fn stop(&self, secret: &str) -> Result<PartyView, String> {
        let mut party = self.lock();
        party.require_master(secret)?;
        if party.phase != PartyPhase::Playing {
            return Err("no round is playing".into());
        }
        party.phase = PartyPhase::Lobby;
        Ok(party.view())
    }

    /// Playback was left before the end: back to the lobby, no scores.
    pub(crate) fn abort(&self) -> PartyView {
        let mut party = self.lock();
        if party.phase == PartyPhase::Playing {
            party.phase = PartyPhase::Lobby;
        }
        party.view()
    }
}

fn song_label(song: &PartySong) -> String {
    if song.artist.trim().is_empty() {
        song.title.clone()
    } else {
        format!("{} – {}", song.artist, song.title)
    }
}

fn resolve_selection(request: PickRequest) -> Result<PartySelection, String> {
    match request.mode {
        PartyPickMode::Song => {
            let hash = request
                .file_hash
                .ok_or_else(|| "choose a song".to_string())?;
            let song = app_core::party_song(&hash)
                .map_err(|error| error.to_string())?
                .ok_or_else(|| "this song is not ready to sing".to_string())?;
            Ok(PartySelection {
                mode: PartyPickMode::Song,
                label: song_label(&song),
                file_hash: Some(song.file_hash),
                genre: None,
            })
        }
        PartyPickMode::Genre => {
            let genre = request
                .genre
                .filter(|genre| !genre.trim().is_empty())
                .ok_or_else(|| "choose a genre".to_string())?;
            Ok(PartySelection {
                mode: PartyPickMode::Genre,
                file_hash: None,
                label: genre.clone(),
                genre: Some(genre),
            })
        }
        PartyPickMode::Random => Ok(PartySelection {
            mode: PartyPickMode::Random,
            file_hash: None,
            genre: None,
            label: String::new(),
        }),
    }
}

fn resolve_song(selection: &PartySelection, previous: Option<&str>) -> Result<PartySong, String> {
    let song = match selection.mode {
        PartyPickMode::Song => selection
            .file_hash
            .as_deref()
            .map(app_core::party_song)
            .transpose()
            .map_err(|error| error.to_string())?
            .flatten(),
        PartyPickMode::Genre => app_core::party_random_song(selection.genre.as_deref(), previous)
            .map_err(|error| error.to_string())?,
        PartyPickMode::Random => {
            app_core::party_random_song(None, previous).map_err(|error| error.to_string())?
        }
    };
    song.ok_or_else(|| "no analysed song matches this choice".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn joined(store: &PartyStore, name: &str) -> String {
        match store.join(name, None) {
            Ok((secret, _)) => secret,
            Err(error) => panic!("join failed: {error}"),
        }
    }

    #[test]
    fn first_player_is_master_and_rejoin_keeps_identity() {
        let store = PartyStore::default();
        assert!(store.join("Alice", None).is_err());
        store.open();
        let alice = joined(&store, "  Alice  ");
        let bob = joined(&store, "Bob");
        let view = store.phone_view(&alice);
        assert_eq!(view.me.as_ref().map(|me| me.master), Some(true));
        assert_eq!(view.me.map(|me| me.name), Some("Alice".to_string()));
        assert_eq!(store.phone_view(&bob).me.map(|me| me.master), Some(false));

        let rejoin = store.join("Alicia", Some(&alice));
        assert_eq!(rejoin.map(|(secret, _)| secret).ok(), Some(alice.clone()));
        assert_eq!(store.view().players.len(), 2);
    }

    #[test]
    fn party_is_capped_and_master_passes_on() {
        let store = PartyStore::default();
        store.open();
        let first = joined(&store, "A");
        for name in ["B", "C", "D"] {
            joined(&store, name);
        }
        assert!(store.join("E", None).is_err());
        store.leave(&first);
        let view = store.view();
        assert_eq!(view.players.len(), 3);
        assert_eq!(view.players.first().map(|p| p.master), Some(true));
    }

    #[test]
    fn only_master_picks_and_winner_takes_over() {
        let store = PartyStore::default();
        store.open();
        let alice = joined(&store, "Alice");
        let bob = joined(&store, "Bob");
        let random = || PickRequest {
            mode: PartyPickMode::Random,
            file_hash: None,
            genre: None,
        };
        assert!(store.pick(&bob, random()).is_err());
        assert!(store.pick(&alice, random()).is_ok());

        let bob_id = store
            .phone_view(&bob)
            .me
            .map(|me| me.id)
            .unwrap_or_default();
        let alice_id = store
            .phone_view(&alice)
            .me
            .map(|me| me.id)
            .unwrap_or_default();
        let result = |id: &str, score| PartyResult {
            player_id: id.to_string(),
            name: String::new(),
            score,
            pitch: 0,
            rhythm: 0,
            lyrics: 0,
        };
        let view = store.finish(vec![result(&alice_id, 40), result(&bob_id, 70)]);
        assert_eq!(view.phase, PartyPhase::Results);
        assert_eq!(
            view.results.first().map(|r| r.player_id.clone()),
            Some(bob_id)
        );
        assert_eq!(store.phone_view(&bob).me.map(|me| me.master), Some(true));
        assert!(view.selection.is_none());
    }

    #[test]
    fn duplicate_names_get_a_suffix() {
        let store = PartyStore::default();
        store.open();
        joined(&store, "Alex");
        let second = joined(&store, "Alex");
        assert_eq!(
            store.phone_view(&second).me.map(|me| me.name),
            Some("Alex 2".into())
        );
        // Rejoining keeps your own name instead of colliding with yourself.
        let again = store.join("Alex 2", Some(&second));
        assert_eq!(
            again.ok().and_then(|(_, view)| view.me).map(|me| me.name),
            Some("Alex 2".into())
        );
    }

    #[test]
    fn names_are_cleaned() {
        assert_eq!(
            clean_name("  Jean   Michel ").ok(),
            Some("Jean Michel".into())
        );
        assert!(clean_name("   ").is_err());
        assert_eq!(
            clean_name("a very long nickname indeed!")
                .map(|n| n.chars().count())
                .ok(),
            Some(NAME_MAX_CHARS)
        );
    }
}

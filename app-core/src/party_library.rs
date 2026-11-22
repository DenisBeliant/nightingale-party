//! Songs a multiplayer party can play: every analysed song, with its genre.
//!
//! The genre is not part of the library schema, so it is read from the
//! file's tags the first time a party needs it and cached for the process.
//! Songs from remote sources (Plex, Jellyfin, …) or without a genre tag fall
//! under "no genre" and are still playable through "random".

use std::collections::{BTreeMap, HashMap};
use std::sync::{Mutex, OnceLock, PoisonError};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::NightingaleError;
use crate::library_db;
use crate::song::Song;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PartySong {
    pub file_hash: String,
    pub title: String,
    pub artist: String,
    pub genre: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PartyGenre {
    pub name: String,
    pub count: u32,
}

fn genre_cache() -> &'static Mutex<HashMap<String, Option<String>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();
    CACHE.get_or_init(Default::default)
}

fn read_genre(song: &Song) -> Option<String> {
    use lofty::file::TaggedFileExt;
    use lofty::tag::Accessor;

    if !song.path.is_file() {
        return None;
    }
    let tagged = lofty::read_from_path(&song.path).ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    tag.genre()
        .map(|genre| normalize_genre(&genre))
        .filter(|genre| !genre.is_empty())
}

/// "rock; pop" → "Rock": first genre, capitalised, so "rock" and "Rock" group.
fn normalize_genre(raw: &str) -> String {
    let first = raw
        .split([';', '/', ','])
        .map(str::trim)
        .find(|part| !part.is_empty())
        .unwrap_or_default();
    let mut characters = first.chars();
    match characters.next() {
        Some(head) => head.to_uppercase().chain(characters).collect(),
        None => String::new(),
    }
}

fn genre_of(song: &Song) -> Option<String> {
    if let Some(cached) = genre_cache()
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get(&song.file_hash)
    {
        return cached.clone();
    }
    let genre = read_genre(song);
    genre_cache()
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .insert(song.file_hash.clone(), genre.clone());
    genre
}

/// Analysed songs, sorted by artist then title.
pub fn party_songs() -> Result<Vec<PartySong>, NightingaleError> {
    Ok(library_db::load_all_songs()?
        .into_iter()
        .filter(|song| song.is_analyzed)
        .map(|song| PartySong {
            genre: genre_of(&song),
            file_hash: song.file_hash,
            title: song.title,
            artist: song.artist,
        })
        .collect())
}

/// Genres present among analysed songs, most common first.
pub fn party_genres() -> Result<Vec<PartyGenre>, NightingaleError> {
    let mut counts: BTreeMap<String, u32> = BTreeMap::new();
    for song in party_songs()? {
        if let Some(genre) = song.genre {
            *counts.entry(genre).or_default() += 1;
        }
    }
    let mut genres: Vec<PartyGenre> = counts
        .into_iter()
        .map(|(name, count)| PartyGenre { name, count })
        .collect();
    genres.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.name.cmp(&b.name)));
    Ok(genres)
}

/// A random analysed song, optionally within `genre`, avoiding `exclude`
/// (the song just played) when there is a choice.
pub fn party_random_song(
    genre: Option<&str>,
    exclude: Option<&str>,
) -> Result<Option<PartySong>, NightingaleError> {
    let pool: Vec<PartySong> = party_songs()?
        .into_iter()
        .filter(|song| genre.is_none_or(|wanted| song.genre.as_deref() == Some(wanted)))
        .collect();
    let preferred: Vec<&PartySong> = pool
        .iter()
        .filter(|song| Some(song.file_hash.as_str()) != exclude)
        .collect();
    let choices = if preferred.is_empty() {
        pool.iter().collect()
    } else {
        preferred
    };
    if choices.is_empty() {
        return Ok(None);
    }
    let index = rand::random_range(0..choices.len());
    Ok(choices.get(index).map(|song| (*song).clone()))
}

/// Unguessable identifier for party players (hex, 128 bits).
pub fn party_token() -> String {
    rand::random::<[u8; 16]>()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// One analysed song by hash.
pub fn party_song(file_hash: &str) -> Result<Option<PartySong>, NightingaleError> {
    Ok(party_songs()?
        .into_iter()
        .find(|song| song.file_hash == file_hash))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genres_are_normalised() {
        assert_eq!(normalize_genre("rock; pop"), "Rock");
        assert_eq!(normalize_genre("  hip-hop/rap"), "Hip-hop");
        assert_eq!(normalize_genre("Électro"), "Électro");
        assert_eq!(normalize_genre(" ; "), "");
    }
}

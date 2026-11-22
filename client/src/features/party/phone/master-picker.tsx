import { useQuery } from '@tanstack/react-query';
import { DicesIcon, ListMusicIcon, MusicIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { loadPartyGenres, loadPartySongs, type PartyPickRequest } from '@/bridge/party';
import { ChunkyButton } from '@/features/party/components/stage';
import { t, tp } from '@/i18n';
import { Input } from '@/shared/components/ui/input';

const MAX_RESULTS = 40;

type PickerProps = {
  busy: boolean;
  onPick: (request: PartyPickRequest) => void;
};

type Mode = 'song' | 'genre' | 'random';

const MODES = [
  { mode: 'song', icon: MusicIcon, label: 'party.picker.song', hint: 'party.picker.songHint' },
  {
    mode: 'genre',
    icon: ListMusicIcon,
    label: 'party.picker.genre',
    hint: 'party.picker.genreHint',
  },
  {
    mode: 'random',
    icon: DicesIcon,
    label: 'party.picker.random',
    hint: 'party.picker.randomHint',
  },
] as const;

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const SongList = ({ busy, onPick }: PickerProps) => {
  const [search, setSearch] = useState('');
  const { data: songs = [] } = useQuery({ queryKey: ['party-songs'], queryFn: loadPartySongs });
  const matches = useMemo(() => {
    const needle = normalize(search.trim());
    return songs
      .filter((song) => needle === '' || normalize(`${song.artist} ${song.title}`).includes(needle))
      .slice(0, MAX_RESULTS);
  }, [search, songs]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('party.picker.searchPlaceholder')}
        aria-label={t('party.picker.searchPlaceholder')}
        className="h-12 rounded-xl text-base"
      />
      <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
        {matches.map((song) => (
          <li key={song.file_hash}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick({ mode: 'song', fileHash: song.file_hash })}
              className="w-full rounded-xl bg-card px-3 py-2.5 text-left hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <span className="block truncate font-bold">{song.title}</span>
              <span className="block truncate text-sm text-white/60">{song.artist}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const GenreList = ({ busy, onPick }: PickerProps) => {
  const { data: genres = [] } = useQuery({ queryKey: ['party-genres'], queryFn: loadPartyGenres });

  if (genres.length === 0) {
    return <p className="text-sm text-white/70">{t('party.picker.noGenres')}</p>;
  }
  return (
    <div className="flex flex-wrap gap-3">
      {genres.map((genre) => (
        <ChunkyButton
          key={genre.name}
          tone="plain"
          disabled={busy}
          onClick={() => onPick({ mode: 'genre', genre: genre.name })}
          className="px-4 py-2 text-base"
        >
          {genre.name}{' '}
          <span className="font-semibold text-white/60">
            {tp('party.picker.songCount', genre.count)}
          </span>
        </ChunkyButton>
      ))}
    </div>
  );
};

/** The game master's choice for the next round: three big game show buttons. */
export const MasterPicker = (props: PickerProps) => {
  const [mode, setMode] = useState<Mode | null>(null);
  const choose = (next: Mode) => {
    setMode(next);
    if (next === 'random') {
      props.onPick({ mode: 'random' });
    }
  };

  const hint = MODES.find((entry) => entry.mode === mode)?.hint;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {MODES.map((entry) => {
          const Icon = entry.icon;
          const active = mode === entry.mode;
          return (
            <ChunkyButton
              key={entry.mode}
              tone={active ? 'primary' : 'plain'}
              aria-pressed={active}
              disabled={props.busy}
              onClick={() => choose(entry.mode)}
              className="flex flex-col items-center gap-1.5 px-2 py-3 text-base"
            >
              <Icon className="size-7" aria-hidden="true" />
              {t(entry.label)}
            </ChunkyButton>
          );
        })}
      </div>
      {hint !== undefined && <p className="text-sm font-semibold text-white/65">{t(hint)}</p>}
      {mode === 'song' && <SongList {...props} />}
      {mode === 'genre' && <GenreList {...props} />}
    </div>
  );
};

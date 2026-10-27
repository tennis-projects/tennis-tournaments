export type GroupKey = 'A' | 'B' | 'C';
export const GROUP_KEYS: GroupKey[] = ['A', 'B', 'C'];

export interface Player {
  id: string;
  name: string;
  birthYear?: number | null;
  createdAt?: number;
}

/** Счёт матча в геймах. null = матч ещё не сыгран. */
export interface Score {
  g1: number | null;
  g2: number | null;
}

export interface GroupMatch extends Score {
  id: string; // M001, M002…
  group: GroupKey;
  p1: string; // id игрока
  p2: string;
  order: number;
}

export type PlayoffSlot = 'SF1' | 'SF2' | 'THIRD' | 'FINAL';

/** Что хранится в базе: участники полуфиналов фиксируются при старте плей-офф,
 *  участники финала и матча за 3 место вычисляются из результатов полуфиналов. */
export interface StoredPlayoff {
  SF1: Score & { p1: string; p2: string };
  SF2: Score & { p1: string; p2: string };
  THIRD: Score;
  FINAL: Score;
}

export interface PlayoffMatch extends Score {
  slot: PlayoffSlot;
  p1: string | null;
  p2: string | null;
}

export type TournamentStatus = 'groups' | 'playoff' | 'finished';

export interface Tournament {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  season: string; // например «2026» или «2026/27»
  status: TournamentStatus;
  groups: Partial<Record<GroupKey, string[]>>;
  matches: Record<string, GroupMatch>;
  playoff: StoredPlayoff | null;
  /** Имена на момент турнира — чтобы история не ломалась при переименовании игрока */
  playerNames: Record<string, string>;
  createdAt: number;
}

export type GroupKey = 'A' | 'B' | 'C' | 'D';
export const GROUP_KEYS: GroupKey[] = ['A', 'B', 'C', 'D'];

export interface Player {
  id: string;
  name: string;
  birthYear?: number | null;
  createdAt?: number;
}

/** Счёт одного сета: a — геймы первого игрока, b — второго. */
export interface SetScore {
  a: number;
  b: number;
}

/** 1 = матч из одного сета, 3 = до двух побед в сетах (максимум 3 сета). */
export type BestOf = 1 | 3;

export interface GroupMatch {
  id: string; // M001, M002…
  group: GroupKey;
  p1: string; // id игрока
  p2: string;
  order: number;
  sets: SetScore[];
}

/**
 * Сетка плей-офф.
 * slots — участники первого круга по порядку (null = BYE), длина = size (2, 4, 8, 16).
 * matches — счёт матчей: ключи `r{круг}m{номер}` (с 1 и 0) и `third` (за 3 место).
 * Участники второго и следующих кругов не хранятся — они вычисляются из результатов.
 */
export interface StoredPlayoff {
  size: number;
  slots: (string | null)[];
  matches: Record<string, { sets: SetScore[] }>;
  thirdPlace: boolean;
}

export type TournamentStatus = 'groups' | 'playoff' | 'finished';

export interface Tournament {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  season: string;
  status: TournamentStatus;
  bestOf: BestOf;
  /** сколько игроков выходит в плей-офф; 0 = без плей-офф */
  playoffSize: number;
  /** играть ли матч за 3 место */
  thirdPlace: boolean;
  groups: Partial<Record<GroupKey, string[]>>;
  matches: Record<string, GroupMatch>;
  playoff: StoredPlayoff | null;
  /** Имена на момент турнира — чтобы история не ломалась при переименовании игрока */
  playerNames: Record<string, string>;
  createdAt: number;
  /** служебное: плей-офф сохранён в старом формате (до сеток) и при записи будет переписан целиком */
  legacyPlayoff?: boolean;
}

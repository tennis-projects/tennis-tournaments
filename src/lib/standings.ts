import type { BestOf, GroupKey, GroupMatch, Tournament } from '../types';
import { GROUP_KEYS } from '../types';
import { matchState } from './score';

export interface StandingRow {
  playerId: string;
  group: GroupKey;
  played: number;
  wins: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
  setsDiff: number;
  gamesFor: number;
  gamesAgainst: number;
  gamesDiff: number;
  place: number;
  /** позиция в исходном списке группы — последний критерий при равенстве */
  seedIndex: number;
}

/**
 * Порядок мест в группе: победы в матчах → разница сетов → разница геймов
 * → выигранные геймы → порядок в списке группы.
 */
export function compareRows(a: StandingRow, b: StandingRow): number {
  return (
    b.wins - a.wins ||
    b.setsDiff - a.setsDiff ||
    b.gamesDiff - a.gamesDiff ||
    b.gamesFor - a.gamesFor ||
    a.seedIndex - b.seedIndex
  );
}

export function groupStandings(group: GroupKey, playerIds: string[], matches: GroupMatch[], bestOf: BestOf): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  playerIds.forEach((id, i) =>
    rows.set(id, {
      playerId: id,
      group,
      played: 0,
      wins: 0,
      losses: 0,
      setsFor: 0,
      setsAgainst: 0,
      setsDiff: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      gamesDiff: 0,
      place: 0,
      seedIndex: i,
    }),
  );

  for (const m of matches) {
    if (m.group !== group) continue;
    const s = matchState(m.sets, bestOf);
    if (!s.complete) continue; // незаконченный матч в таблицу не идёт
    const r1 = rows.get(m.p1);
    const r2 = rows.get(m.p2);
    if (!r1 || !r2) continue;
    r1.played++;
    r2.played++;
    r1.setsFor += s.setsA;
    r1.setsAgainst += s.setsB;
    r2.setsFor += s.setsB;
    r2.setsAgainst += s.setsA;
    r1.gamesFor += s.gamesA;
    r1.gamesAgainst += s.gamesB;
    r2.gamesFor += s.gamesB;
    r2.gamesAgainst += s.gamesA;
    if (s.winner === 1) {
      r1.wins++;
      r2.losses++;
    } else {
      r2.wins++;
      r1.losses++;
    }
  }

  const list = [...rows.values()];
  for (const r of list) {
    r.setsDiff = r.setsFor - r.setsAgainst;
    r.gamesDiff = r.gamesFor - r.gamesAgainst;
  }
  list.sort(compareRows);
  list.forEach((r, i) => (r.place = i + 1));
  return list;
}

export function activeGroups(t: Pick<Tournament, 'groups'>): GroupKey[] {
  return GROUP_KEYS.filter((g) => (t.groups[g]?.length ?? 0) > 0);
}

export function allStandings(t: Pick<Tournament, 'groups' | 'matches' | 'bestOf'>): Record<GroupKey, StandingRow[]> {
  const matches = Object.values(t.matches);
  const out = {} as Record<GroupKey, StandingRow[]>;
  for (const g of activeGroups(t)) out[g] = groupStandings(g, t.groups[g] ?? [], matches, t.bestOf);
  return out;
}

export function sortedMatches(t: Pick<Tournament, 'matches'>): GroupMatch[] {
  return Object.values(t.matches).sort((a, b) => a.order - b.order);
}

export function allGroupMatchesPlayed(t: Pick<Tournament, 'matches' | 'bestOf'>): boolean {
  return Object.values(t.matches).every((m) => matchState(m.sets, t.bestOf).complete);
}

/** Матч двух игроков группы (в любом порядке). */
export function findGroupMatch(t: Pick<Tournament, 'matches'>, x: string, y: string): GroupMatch | undefined {
  return Object.values(t.matches).find((m) => (m.p1 === x && m.p2 === y) || (m.p1 === y && m.p2 === x));
}

/** Круговая система: каждый с каждым, в порядке как в Excel (1–2, 1–3, 1–4, 2–3, 2–4, 3–4). */
export function buildGroupMatches(groups: Partial<Record<GroupKey, string[]>>): Record<string, GroupMatch> {
  const out: Record<string, GroupMatch> = {};
  let n = 0;
  for (const g of GROUP_KEYS) {
    const ids = groups[g] ?? [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        n++;
        const id = 'M' + String(n).padStart(3, '0');
        out[id] = { id, group: g, p1: ids[i], p2: ids[j], order: n, sets: [] };
      }
    }
  }
  return out;
}

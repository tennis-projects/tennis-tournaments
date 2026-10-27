import type { GroupKey, GroupMatch, Score, Tournament } from '../types';
import { GROUP_KEYS } from '../types';

export interface StandingRow {
  playerId: string;
  group: GroupKey;
  played: number;
  wins: number;
  losses: number;
  gamesFor: number;
  gamesAgainst: number;
  diff: number;
  points: number;
  place: number;
  /** позиция в исходном списке группы — последний критерий при равенстве */
  seedIndex: number;
}

/** Матч считается сыгранным, когда введены оба числа и они не равны. */
export function isPlayed(m: Score): boolean {
  return m.g1 != null && m.g2 != null && m.g1 !== m.g2;
}

export function winnerSide(m: Score): 1 | 2 | null {
  if (!isPlayed(m)) return null;
  return (m.g1 as number) > (m.g2 as number) ? 1 : 2;
}

/** Порядок сравнения: победы → разница геймов → выигранные геймы → порядок в списке. */
export function compareRows(a: StandingRow, b: StandingRow): number {
  return (
    b.wins - a.wins ||
    b.diff - a.diff ||
    b.gamesFor - a.gamesFor ||
    a.seedIndex - b.seedIndex
  );
}

export function groupStandings(group: GroupKey, playerIds: string[], matches: GroupMatch[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  playerIds.forEach((id, i) =>
    rows.set(id, {
      playerId: id,
      group,
      played: 0,
      wins: 0,
      losses: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      diff: 0,
      points: 0,
      place: 0,
      seedIndex: i,
    }),
  );

  for (const m of matches) {
    if (m.group !== group || !isPlayed(m)) continue;
    const r1 = rows.get(m.p1);
    const r2 = rows.get(m.p2);
    if (!r1 || !r2) continue;
    const g1 = m.g1 as number;
    const g2 = m.g2 as number;
    r1.played++;
    r2.played++;
    r1.gamesFor += g1;
    r1.gamesAgainst += g2;
    r2.gamesFor += g2;
    r2.gamesAgainst += g1;
    if (g1 > g2) {
      r1.wins++;
      r2.losses++;
    } else {
      r2.wins++;
      r1.losses++;
    }
  }

  const list = [...rows.values()];
  for (const r of list) {
    r.diff = r.gamesFor - r.gamesAgainst;
    r.points = r.wins; // 1 очко за победу
  }
  list.sort(compareRows);
  list.forEach((r, i) => (r.place = i + 1));
  return list;
}

export function activeGroups(t: Pick<Tournament, 'groups'>): GroupKey[] {
  return GROUP_KEYS.filter((g) => (t.groups[g]?.length ?? 0) > 0);
}

export function allStandings(t: Pick<Tournament, 'groups' | 'matches'>): Record<GroupKey, StandingRow[]> {
  const matches = Object.values(t.matches);
  const out = {} as Record<GroupKey, StandingRow[]>;
  for (const g of activeGroups(t)) out[g] = groupStandings(g, t.groups[g] ?? [], matches);
  return out;
}

export function sortedMatches(t: Pick<Tournament, 'matches'>): GroupMatch[] {
  return Object.values(t.matches).sort((a, b) => a.order - b.order);
}

export function allGroupMatchesPlayed(t: Pick<Tournament, 'matches'>): boolean {
  return Object.values(t.matches).every(isPlayed);
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
        out[id] = { id, group: g, p1: ids[i], p2: ids[j], g1: null, g2: null, order: n };
      }
    }
  }
  return out;
}

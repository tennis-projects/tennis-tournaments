import type { PlayoffMatch, StoredPlayoff, Tournament } from '../types';
import { activeGroups, allStandings, compareRows, isPlayed, winnerSide, type StandingRow } from './standings';

/**
 * Кто выходит в полуфиналы.
 * 2 группы: SF1 = A1 – B2, SF2 = B1 – A2.
 * 3 группы: победители A/B/C + лучший второй. Победители упорядочиваются между собой
 * (победы → разница → выигранные геймы). Лучший победитель играет с лучшим вторым,
 * если они не из одной группы; иначе лучший победитель играет с третьим победителем.
 * Возвращает null, если сетку построить нельзя (1 группа или пустые места).
 */
export function seedSemifinals(t: Pick<Tournament, 'groups' | 'matches'>): StoredPlayoff | null {
  const groups = activeGroups(t);
  const st = allStandings(t);
  const sf = (p1: string, p2: string) => ({ p1, p2, g1: null, g2: null });
  const empty = { g1: null, g2: null };

  if (groups.length === 2) {
    const [a, b] = groups;
    const A = st[a];
    const B = st[b];
    if (A.length < 2 || B.length < 2) return null;
    return { SF1: sf(A[0].playerId, B[1].playerId), SF2: sf(B[0].playerId, A[1].playerId), THIRD: empty, FINAL: empty };
  }

  if (groups.length === 3) {
    if (groups.some((g) => st[g].length < 2)) return null;
    const winners: StandingRow[] = groups.map((g) => st[g][0]).sort(compareAcrossGroups);
    const best2 = groups.map((g) => st[g][1]).sort(compareAcrossGroups)[0];
    const [w1, w2, w3] = winners;
    if (best2.group !== w1.group) {
      return { SF1: sf(w1.playerId, best2.playerId), SF2: sf(w2.playerId, w3.playerId), THIRD: empty, FINAL: empty };
    }
    return { SF1: sf(w1.playerId, w3.playerId), SF2: sf(w2.playerId, best2.playerId), THIRD: empty, FINAL: empty };
  }

  return null;
}

/** Сравнение игроков из разных групп: порядок в группе не учитываем. */
export function compareAcrossGroups(a: StandingRow, b: StandingRow): number {
  return compareRows({ ...a, seedIndex: 0 }, { ...b, seedIndex: 0 }) || a.group.localeCompare(b.group);
}

function sideId(m: { p1: string | null; p2: string | null } & { g1: number | null; g2: number | null }, want: 'winner' | 'loser') {
  const w = winnerSide(m);
  if (w == null) return null;
  const winnerIsP1 = w === 1;
  return want === 'winner' ? (winnerIsP1 ? m.p1 : m.p2) : winnerIsP1 ? m.p2 : m.p1;
}

/** Полная сетка плей-офф: финал = победители полуфиналов, за 3 место = проигравшие. */
export function resolvePlayoff(p: StoredPlayoff): Record<'SF1' | 'SF2' | 'THIRD' | 'FINAL', PlayoffMatch> {
  const SF1: PlayoffMatch = { slot: 'SF1', ...p.SF1 };
  const SF2: PlayoffMatch = { slot: 'SF2', ...p.SF2 };
  const FINAL: PlayoffMatch = { slot: 'FINAL', p1: sideId(SF1, 'winner'), p2: sideId(SF2, 'winner'), ...p.FINAL };
  const THIRD: PlayoffMatch = { slot: 'THIRD', p1: sideId(SF1, 'loser'), p2: sideId(SF2, 'loser'), ...p.THIRD };
  return { SF1, SF2, THIRD, FINAL };
}

export function playoffMatchWinner(m: PlayoffMatch): string | null {
  if (!m.p1 || !m.p2 || !isPlayed(m)) return null;
  return sideId(m, 'winner');
}

export function playoffMatchLoser(m: PlayoffMatch): string | null {
  if (!m.p1 || !m.p2 || !isPlayed(m)) return null;
  return sideId(m, 'loser');
}

export const PLAYOFF_LABELS: Record<PlayoffMatch['slot'], string> = {
  SF1: '1/2 финала · 1',
  SF2: '1/2 финала · 2',
  THIRD: 'Матч за 3 место',
  FINAL: 'Финал',
};

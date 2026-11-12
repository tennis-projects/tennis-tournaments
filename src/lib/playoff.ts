import type { SetScore, StoredPlayoff, Tournament } from '../types';
import { matchState, type MatchState } from './score';
import { activeGroups, allStandings, compareRows, type StandingRow } from './standings';

// ── Кто выходит в плей-офф ───────────────────────────────────

/** Сравнение игроков из разных групп: порядок внутри группы не учитываем. */
export function compareAcrossGroups(a: StandingRow, b: StandingRow): number {
  return compareRows({ ...a, seedIndex: 0 }, { ...b, seedIndex: 0 }) || a.group.localeCompare(b.group);
}

/**
 * Выходящие в плей-офф, по порядку посева: сначала все первые места групп,
 * затем лучшие из вторых, затем из третьих… пока не наберётся playoffSize.
 * Примеры: 2 группы и 4 места → по двое из группы; 3 группы и 4 места → победители + лучший второй.
 */
export function qualifiers(t: Pick<Tournament, 'groups' | 'matches' | 'bestOf' | 'playoffSize'>): StandingRow[] {
  const st = allStandings(t);
  const all = activeGroups(t)
    .flatMap((g) => st[g])
    .sort((a, b) => a.place - b.place || compareAcrossGroups(a, b));
  return all.slice(0, Math.min(t.playoffSize, all.length));
}

export function bracketSize(n: number): number {
  let s = 2;
  while (s < n) s *= 2;
  return s;
}

/** Классическая расстановка посевов: для 8 → [1,8,4,5,2,7,3,6]. Первые двое — в разных половинах. */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    order = order.flatMap((s) => [s, n - s]);
  }
  return order;
}

/** В каком круге встретятся игроки из позиций i и j (1 = первый круг). */
export function meetingRound(i: number, j: number): number {
  return Math.floor(Math.log2(i ^ j)) + 1;
}

/**
 * Строит сетку. Посевы 1 и 2 стоят на своих местах, BYE достаются сильнейшим.
 * Остальных переставляем так, чтобы игроки из одной группы встречались как можно позже.
 */
export function seedBracket(t: Pick<Tournament, 'groups' | 'matches' | 'bestOf' | 'playoffSize' | 'thirdPlace'>): StoredPlayoff | null {
  const q = qualifiers(t);
  if (q.length < 2) return null;
  const size = bracketSize(q.length);
  const order = seedOrder(size);
  const slots: (StandingRow | null)[] = order.map((seed) => q[seed - 1] ?? null);

  // позиции, которые можно менять между собой: занятые игроками с посевом 3 и ниже
  const movable = order.map((seed, i) => (seed >= 3 && seed <= q.length ? i : -1)).filter((i) => i >= 0);
  const rounds = Math.log2(size);

  const cost = () => {
    let c = 0;
    for (let i = 0; i < size; i++)
      for (let j = i + 1; j < size; j++) {
        const a = slots[i];
        const b = slots[j];
        if (a && b && a.group === b.group) c += 100 ** (rounds - meetingRound(i, j));
      }
    return c;
  };

  let best = cost();
  for (let improved = true; improved; ) {
    improved = false;
    for (const i of movable)
      for (const j of movable) {
        if (i >= j) continue;
        [slots[i], slots[j]] = [slots[j], slots[i]];
        const c = cost();
        if (c < best) {
          best = c;
          improved = true;
        } else {
          [slots[i], slots[j]] = [slots[j], slots[i]];
        }
      }
  }

  const matches: StoredPlayoff['matches'] = {};
  for (let r = 1; r <= rounds; r++) for (let m = 0; m < size / 2 ** r; m++) matches[`r${r}m${m}`] = { sets: [] };
  const thirdPlace = t.thirdPlace && size >= 4;
  if (thirdPlace) matches.third = { sets: [] };

  return { size, slots: slots.map((s) => s?.playerId ?? null), matches, thirdPlace };
}

// ── Разбор сетки ─────────────────────────────────────────────

export interface BracketMatch {
  id: string;
  round: number; // 1…rounds; для матча за 3 место = rounds
  index: number;
  p1: string | null;
  p2: string | null;
  /** соперник отсутствует по жребию (только 1-й круг) */
  bye1: boolean;
  bye2: boolean;
  sets: SetScore[];
  state: MatchState;
  winner: string | null;
  loser: string | null;
  isThird: boolean;
}

export interface ResolvedBracket {
  size: number;
  rounds: BracketMatch[][];
  third: BracketMatch | null;
  final: BracketMatch;
}

export function roundName(round: number, rounds: number): string {
  const left = rounds - round; // 0 = финал
  if (left === 0) return 'Финал';
  if (left === 1) return '1/2 финала';
  if (left === 2) return '1/4 финала';
  if (left === 3) return '1/8 финала';
  return `${round}-й круг`;
}

export function resolveBracket(t: Pick<Tournament, 'playoff' | 'bestOf'>): ResolvedBracket | null {
  const p = t.playoff;
  if (!p) return null;
  const rounds = Math.log2(p.size);
  const out: BracketMatch[][] = [];

  const make = (id: string, round: number, index: number, p1: string | null, p2: string | null, bye1: boolean, bye2: boolean, isThird = false): BracketMatch => {
    const sets = p.matches[id]?.sets ?? [];
    const both = Boolean(p1 && p2);
    const state = matchState(both ? sets : [], t.bestOf);
    let winner: string | null = null;
    let loser: string | null = null;
    if (both && state.winner) {
      winner = state.winner === 1 ? p1 : p2;
      loser = state.winner === 1 ? p2 : p1;
    } else if (p1 && bye2) winner = p1;
    else if (p2 && bye1) winner = p2;
    return { id, round, index, p1, p2, bye1, bye2, sets: both ? sets : [], state, winner, loser, isThird };
  };

  const first: BracketMatch[] = [];
  for (let m = 0; m < p.size / 2; m++) {
    const a = p.slots[2 * m] ?? null;
    const b = p.slots[2 * m + 1] ?? null;
    first.push(make(`r1m${m}`, 1, m, a, b, a == null, b == null));
  }
  out.push(first);

  for (let r = 2; r <= rounds; r++) {
    const prev = out[r - 2];
    const cur: BracketMatch[] = [];
    for (let m = 0; m < prev.length / 2; m++) {
      cur.push(make(`r${r}m${m}`, r, m, prev[2 * m].winner, prev[2 * m + 1].winner, false, false));
    }
    out.push(cur);
  }

  let third: BracketMatch | null = null;
  if (p.thirdPlace && rounds >= 2) {
    const semis = out[rounds - 2];
    third = make('third', rounds, 0, semis[0].loser, semis[1].loser, false, false, true);
  }
  return { size: p.size, rounds: out, third, final: out[rounds - 1][0] };
}

export function bracketDone(b: ResolvedBracket): boolean {
  const thirdOk = !b.third || !(b.third.p1 && b.third.p2) || b.third.state.complete;
  return Boolean(b.final.winner) && thirdOk;
}

/**
 * Какие матчи зависят от результата матча id (следующие круги и матч за 3 место).
 * Если победитель изменится, их счёт нужно сбросить.
 */
export function downstreamMatches(p: StoredPlayoff, id: string): string[] {
  const rounds = Math.log2(p.size);
  const m = /^r(\d+)m(\d+)$/.exec(id);
  if (!m) return [];
  let r = Number(m[1]);
  let i = Number(m[2]);
  const out: string[] = [];
  const touchesSemis = r <= rounds - 1;
  while (r < rounds) {
    r++;
    i = Math.floor(i / 2);
    out.push(`r${r}m${i}`);
  }
  if (p.thirdPlace && touchesSemis) out.push('third');
  return out;
}

/** Старый формат (до сеток): SF1/SF2/THIRD/FINAL со счётом g1/g2 → новая сетка на 4. */
export function convertLegacyPlayoff(raw: Record<string, { p1?: string; p2?: string; g1?: number | null; g2?: number | null }>): StoredPlayoff {
  const sets = (m?: { g1?: number | null; g2?: number | null }) =>
    m && m.g1 != null && m.g2 != null ? [{ a: m.g1, b: m.g2 }] : [];
  return {
    size: 4,
    slots: [raw.SF1?.p1 ?? null, raw.SF1?.p2 ?? null, raw.SF2?.p1 ?? null, raw.SF2?.p2 ?? null],
    matches: {
      r1m0: { sets: sets(raw.SF1) },
      r1m1: { sets: sets(raw.SF2) },
      r2m0: { sets: sets(raw.FINAL) },
      third: { sets: sets(raw.THIRD) },
    },
    thirdPlace: true,
  };
}

import type { Tournament } from '../types';
import { compareAcrossGroups, resolveBracket } from './playoff';
import { matchState } from './score';
import { activeGroups, allStandings, type StandingRow } from './standings';

/**
 * Очки рейтинга сезона за итоговое место в турнире.
 * Индекс 0 = 1 место, 1 = 2 место и т.д. Всем, кто ниже, — PARTICIPATION_POINTS.
 * Если место делят несколько игроков (например, проигравшие в 1/4 — все «5 место»), очки у них одинаковые.
 */
export const RATING_POINTS = [100, 70, 50, 40, 25, 20, 15, 12, 10, 8, 6, 4];
export const PARTICIPATION_POINTS = 2;

export function pointsForPlace(place: number): number {
  return RATING_POINTS[place - 1] ?? PARTICIPATION_POINTS;
}

export interface Placing {
  playerId: string;
  place: number;
}

/**
 * Итоговые места.
 * Плей-офф: 1 и 2 — финал; 3 и 4 — матч за 3 место (без него оба проигравших в 1/2 делят 3 место);
 * проигравшие в 1/4 делят 5 место, в 1/8 — 9 место и т.д.
 * Не вышедшие из группы — дальше, по месту в группе, затем по показателям.
 */
export function finalPlacings(t: Tournament): Placing[] {
  const st = allStandings(t);
  const rowOf = new Map<string, StandingRow>();
  for (const g of activeGroups(t)) for (const r of st[g]) rowOf.set(r.playerId, r);
  const byStats = (a: string, b: string) => {
    const ra = rowOf.get(a);
    const rb = rowOf.get(b);
    if (!ra || !rb) return 0;
    return ra.place - rb.place || compareAcrossGroups(ra, rb);
  };

  const out: Placing[] = [];
  const used = new Set<string>();
  const push = (ids: string[], place: number) => {
    for (const id of ids.filter((x) => !used.has(x)).sort(byStats)) {
      out.push({ playerId: id, place });
      used.add(id);
    }
  };

  const b = resolveBracket(t);
  if (b) {
    const R = b.rounds.length;
    // финал
    if (b.final.winner) {
      push([b.final.winner], 1);
      if (b.final.loser) push([b.final.loser], 2);
    } else {
      push([b.final.p1, b.final.p2].filter(Boolean) as string[], 1);
    }
    // полуфиналы и матч за 3 место
    if (R >= 2) {
      const semiLosers = b.rounds[R - 2].map((m) => m.loser).filter(Boolean) as string[];
      if (b.third?.winner) {
        push([b.third.winner], 3);
        if (b.third.loser) push([b.third.loser], 4);
      } else {
        push(semiLosers, 3);
      }
    }
    // проигравшие в более ранних кругах делят место
    for (let r = R - 2; r >= 1; r--) {
      const losers = b.rounds[r - 1].map((m) => m.loser).filter(Boolean) as string[];
      push(losers, out.length + 1);
    }
    // те, кто ещё в сетке, но не доиграл
    const stillIn = b.rounds.flat().flatMap((m) => [m.p1, m.p2]).filter((x): x is string => Boolean(x) && !used.has(x as string));
    push([...new Set(stillIn)], out.length + 1);
  }

  const rest = [...rowOf.keys()].filter((id) => !used.has(id)).sort(byStats);
  for (const id of rest) {
    out.push({ playerId: id, place: out.length + 1 });
    used.add(id);
  }
  return out;
}

export interface PlayerMatchRecord {
  wins: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
}

/** Победы/поражения, сеты и геймы игрока за весь турнир (группа + плей-офф, без BYE). */
export function playerRecord(t: Tournament, playerId: string): PlayerMatchRecord {
  const rec: PlayerMatchRecord = { wins: 0, losses: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0 };
  const add = (p1: string | null, p2: string | null, sets: { a: number; b: number }[]) => {
    if (!p1 || !p2 || (p1 !== playerId && p2 !== playerId)) return;
    const s = matchState(sets, t.bestOf);
    if (!s.complete) return;
    const first = p1 === playerId;
    rec.setsFor += first ? s.setsA : s.setsB;
    rec.setsAgainst += first ? s.setsB : s.setsA;
    rec.gamesFor += first ? s.gamesA : s.gamesB;
    rec.gamesAgainst += first ? s.gamesB : s.gamesA;
    if ((s.winner === 1) === first) rec.wins++;
    else rec.losses++;
  };
  for (const m of Object.values(t.matches)) add(m.p1, m.p2, m.sets);
  const b = resolveBracket(t);
  if (b) for (const m of [...b.rounds.flat(), ...(b.third ? [b.third] : [])]) add(m.p1, m.p2, m.sets);
  return rec;
}

export function tournamentPlayerIds(t: Pick<Tournament, 'groups'>): string[] {
  return activeGroups(t).flatMap((g) => t.groups[g] ?? []);
}

export interface SeasonRow {
  playerId: string;
  name: string;
  points: number;
  tournaments: number;
  titles: number;
  podiums: number;
  wins: number;
  losses: number;
  gamesDiff: number;
  best: number;
}

/** Рейтинг сезона: только завершённые турниры выбранного сезона. */
export function seasonRating(tournaments: Tournament[], season: string, currentNames: Record<string, string>): SeasonRow[] {
  const rows = new Map<string, SeasonRow>();
  for (const t of tournaments) {
    if (t.season !== season || t.status !== 'finished') continue;
    for (const pl of finalPlacings(t)) {
      const id = pl.playerId;
      let r = rows.get(id);
      if (!r) {
        r = {
          playerId: id,
          name: currentNames[id] ?? t.playerNames[id] ?? '—',
          points: 0,
          tournaments: 0,
          titles: 0,
          podiums: 0,
          wins: 0,
          losses: 0,
          gamesDiff: 0,
          best: Infinity,
        };
        rows.set(id, r);
      }
      const rec = playerRecord(t, id);
      r.points += pointsForPlace(pl.place);
      r.tournaments++;
      if (pl.place === 1) r.titles++;
      if (pl.place <= 3) r.podiums++;
      r.best = Math.min(r.best, pl.place);
      r.wins += rec.wins;
      r.losses += rec.losses;
      r.gamesDiff += rec.gamesFor - rec.gamesAgainst;
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.titles - a.titles || b.wins - a.wins || b.gamesDiff - a.gamesDiff || a.name.localeCompare(b.name, 'ru'),
  );
}

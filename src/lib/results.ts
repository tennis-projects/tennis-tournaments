import type { Tournament } from '../types';
import { compareAcrossGroups, playoffMatchLoser, playoffMatchWinner, resolvePlayoff } from './playoff';
import { activeGroups, allStandings, isPlayed, winnerSide } from './standings';

/**
 * Очки рейтинга сезона за итоговое место в турнире.
 * Меняйте таблицу как удобно клубу: индекс 0 = 1 место, 1 = 2 место и т.д.
 * Всем, кто ниже последнего значения в таблице, начисляется PARTICIPATION_POINTS.
 */
export const RATING_POINTS = [100, 70, 50, 40, 25, 20, 15, 12, 10, 8, 6, 4];
export const PARTICIPATION_POINTS = 2;

export function pointsForPlace(place: number): number {
  return RATING_POINTS[place - 1] ?? PARTICIPATION_POINTS;
}

export interface Placing {
  playerId: string;
  place: number;
  /** итоговое место окончательно (турнир завершён или место уже не может измениться) */
  final: boolean;
}

/** Итоговые места: 1–4 из плей-офф, остальные — по месту в группе, затем по показателям. */
export function finalPlacings(t: Tournament): Placing[] {
  const st = allStandings(t);
  const groups = activeGroups(t);
  const done = t.status === 'finished';
  const out: Placing[] = [];
  const used = new Set<string>();

  if (t.playoff) {
    const p = resolvePlayoff(t.playoff);
    const top = [
      playoffMatchWinner(p.FINAL),
      playoffMatchLoser(p.FINAL),
      playoffMatchWinner(p.THIRD),
      playoffMatchLoser(p.THIRD),
    ];
    top.forEach((id, i) => {
      if (id && !used.has(id)) {
        out.push({ playerId: id, place: i + 1, final: true });
        used.add(id);
      }
    });
    // полуфиналисты, чьи матчи ещё не доиграны
    for (const id of [p.SF1.p1, p.SF1.p2, p.SF2.p1, p.SF2.p2]) {
      if (id && !used.has(id)) {
        out.push({ playerId: id, place: out.length + 1, final: false });
        used.add(id);
      }
    }
  }

  const rest = groups
    .flatMap((g) => st[g])
    .filter((r) => !used.has(r.playerId))
    .sort((a, b) => a.place - b.place || compareAcrossGroups(a, b));
  for (const r of rest) {
    out.push({ playerId: r.playerId, place: out.length + 1, final: done });
  }
  return out;
}

export interface PlayerMatchRecord {
  wins: number;
  losses: number;
  gamesFor: number;
  gamesAgainst: number;
}

/** Победы/поражения и геймы игрока за весь турнир (группа + плей-офф). */
export function playerRecord(t: Tournament, playerId: string): PlayerMatchRecord {
  const rec: PlayerMatchRecord = { wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0 };
  const add = (p1: string | null, p2: string | null, g1: number | null, g2: number | null) => {
    if (!isPlayed({ g1, g2 }) || (p1 !== playerId && p2 !== playerId)) return;
    const mine = p1 === playerId ? (g1 as number) : (g2 as number);
    const theirs = p1 === playerId ? (g2 as number) : (g1 as number);
    rec.gamesFor += mine;
    rec.gamesAgainst += theirs;
    const w = winnerSide({ g1, g2 });
    if ((w === 1 && p1 === playerId) || (w === 2 && p2 === playerId)) rec.wins++;
    else rec.losses++;
  };
  for (const m of Object.values(t.matches)) add(m.p1, m.p2, m.g1, m.g2);
  if (t.playoff) {
    for (const m of Object.values(resolvePlayoff(t.playoff))) add(m.p1, m.p2, m.g1, m.g2);
  }
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

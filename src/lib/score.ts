import type { BestOf, SetScore } from '../types';

export interface MatchState {
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  /** 1 или 2 — кто выиграл матч; null — матч не окончен */
  winner: 1 | 2 | null;
  complete: boolean;
  started: boolean;
}

export const setsToWin = (bestOf: BestOf) => (bestOf === 3 ? 2 : 1);

/** Итог матча по сетам. Матч окончен, когда кто-то выиграл нужное число сетов. */
export function matchState(sets: SetScore[] | undefined, bestOf: BestOf): MatchState {
  const need = setsToWin(bestOf);
  const s: MatchState = { setsA: 0, setsB: 0, gamesA: 0, gamesB: 0, winner: null, complete: false, started: false };
  for (const set of sets ?? []) {
    if (s.complete) break;
    s.started = true;
    s.gamesA += set.a;
    s.gamesB += set.b;
    if (set.a > set.b) s.setsA++;
    else if (set.b > set.a) s.setsB++;
    if (s.setsA === need) s.winner = 1;
    if (s.setsB === need) s.winner = 2;
    s.complete = s.winner != null;
  }
  return s;
}

/** Проверка введённого счёта. Возвращает текст ошибки или null. Незаконченный матч допустим. */
export function validateSets(sets: SetScore[], bestOf: BestOf): string | null {
  if (sets.length > bestOf) return `Не больше ${bestOf} сет${bestOf === 1 ? 'а' : 'ов'}`;
  const need = setsToWin(bestOf);
  let a = 0;
  let b = 0;
  for (let i = 0; i < sets.length; i++) {
    const { a: x, b: y } = sets[i];
    if (![x, y].every((v) => Number.isInteger(v) && v >= 0 && v <= 99)) return `Сет ${i + 1}: только целые числа 0–99`;
    if (x === y) return `Сет ${i + 1}: в сете не бывает ничьей`;
    if (a === need || b === need) return `Матч уже закончился после сета ${i}, сет ${i + 1} лишний`;
    if (x > y) a++;
    else b++;
  }
  return null;
}

/** «6:3 4:6 7:5». flip — показать со стороны второго игрока. */
export function formatSets(sets: SetScore[], flip = false): string {
  return sets.map((s) => (flip ? `${s.b}:${s.a}` : `${s.a}:${s.b}`)).join(' ');
}

export const BEST_OF_LABEL: Record<BestOf, string> = {
  1: '1 сет',
  3: 'до 2 побед (3 сета)',
};

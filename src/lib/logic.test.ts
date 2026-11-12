import { describe, expect, it } from 'vitest';
import type { GroupKey, Tournament } from '../types';
import { normalizeTournament } from './normalize';
import { bracketDone, downstreamMatches, meetingRound, resolveBracket, seedBracket, seedOrder } from './playoff';
import { finalPlacings, playerRecord, seasonRating } from './results';
import { matchState, validateSets } from './score';
import { allStandings, buildGroupMatches } from './standings';

function mk(groups: Partial<Record<GroupKey, string[]>>, extra: Partial<Tournament> = {}): Tournament {
  const ids = Object.values(groups).flat() as string[];
  return {
    id: 't', name: 'T', date: '2026-10-20', season: '2026', status: 'groups', bestOf: 1, playoffSize: 4, thirdPlace: true,
    groups, matches: buildGroupMatches(groups), playoff: null,
    playerNames: Object.fromEntries(ids.map((n) => [n, n])), createdAt: 0, ...extra,
  };
}

// Данные из файла «Теннисный_турнир_пример.xlsx» (1 сет, счёт в геймах)
function excelTournament(): Tournament {
  const t = mk({ A: ['Варя', 'Марина', 'Петр', 'Миша'], B: ['Ярослав', 'Ульяна', 'Крис', 'Весна'] });
  const scores: [number, number][] = [
    [4, 1], [4, 1], [1, 4], [4, 2], [0, 4], [0, 4],
    [2, 4], [0, 4], [4, 2], [4, 2], [1, 4], [0, 4],
  ];
  Object.values(t.matches).sort((a, b) => a.order - b.order).forEach((m, i) => (m.sets = [{ a: scores[i][0], b: scores[i][1] }]));
  return t;
}

function play(t: Tournament, id: string, sets: [number, number][]) {
  t.playoff!.matches[id] = { sets: sets.map(([a, b]) => ({ a, b })) };
}

describe('счёт по сетам', () => {
  it('до 2 побед: 6:4 3:6 7:5 — победа первого 2:1', () => {
    const s = matchState([{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 5 }], 3);
    expect(s).toMatchObject({ setsA: 2, setsB: 1, gamesA: 16, gamesB: 15, winner: 1, complete: true });
  });
  it('один сет из трёх — матч идёт', () => {
    expect(matchState([{ a: 6, b: 4 }], 3)).toMatchObject({ complete: false, started: true, winner: null });
  });
  it('проверка ввода', () => {
    expect(validateSets([{ a: 6, b: 6 }], 3)).toMatch(/ничьей/);
    expect(validateSets([{ a: 6, b: 1 }, { a: 6, b: 2 }, { a: 6, b: 3 }], 3)).toMatch(/лишний/);
    expect(validateSets([{ a: 6, b: 1 }, { a: 2, b: 6 }], 3)).toBeNull();
    expect(validateSets([{ a: 4, b: 1 }, { a: 4, b: 2 }], 1)).toMatch(/Не больше 1/);
  });
});

describe('группы', () => {
  it('таблицы как в Excel', () => {
    const st = allStandings(excelTournament());
    expect(st.A.map((r) => [r.playerId, r.wins, r.gamesDiff])).toEqual([
      ['Миша', 3, 11], ['Варя', 2, 3], ['Марина', 1, -5], ['Петр', 0, -9],
    ]);
    expect(st.B.map((r) => [r.playerId, r.wins, r.gamesDiff])).toEqual([
      ['Весна', 2, 5], ['Ульяна', 2, 1], ['Крис', 1, -2], ['Ярослав', 1, -4],
    ]);
  });

  it('3 сета: при равенстве побед решает разница сетов', () => {
    const t = mk({ A: ['x', 'y', 'z'] }, { bestOf: 3 });
    const [xy, xz, yz] = Object.values(t.matches).sort((a, b) => a.order - b.order);
    xy.sets = [{ a: 6, b: 0 }, { a: 6, b: 0 }]; // x 2:0
    xz.sets = [{ a: 6, b: 4 }, { a: 4, b: 6 }, { a: 4, b: 6 }]; // z 2:1
    yz.sets = [{ a: 6, b: 4 }, { a: 6, b: 4 }]; // y 2:0
    const st = allStandings(t).A;
    // все по 1 победе: x сеты 3–2, y 2–2, z 2–3
    expect(st.map((r) => [r.playerId, r.setsFor, r.setsAgainst])).toEqual([['x', 3, 2], ['y', 2, 2], ['z', 2, 3]]);
  });

  it('незаконченный матч не идёт в таблицу', () => {
    const t = mk({ A: ['x', 'y'] }, { bestOf: 3 });
    Object.values(t.matches)[0].sets = [{ a: 6, b: 2 }];
    expect(allStandings(t).A[0].played).toBe(0);
  });
});

describe('сетка', () => {
  it('порядок посевов', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(meetingRound(0, 1)).toBe(1);
    expect(meetingRound(0, 3)).toBe(2);
    expect(meetingRound(0, 7)).toBe(3);
  });

  it('2 группы → 1/2 финала A1–B2 и B1–A2, итоги как в Excel', () => {
    const t = excelTournament();
    t.playoff = seedBracket(t)!;
    expect(t.playoff.slots).toEqual(['Миша', 'Ульяна', 'Весна', 'Варя']);
    play(t, 'r1m0', [[4, 0]]);
    play(t, 'r1m1', [[4, 1]]);
    let b = resolveBracket(t)!;
    expect([b.final.p1, b.final.p2]).toEqual(['Миша', 'Весна']);
    expect([b.third!.p1, b.third!.p2]).toEqual(['Ульяна', 'Варя']);
    play(t, 'r2m0', [[4, 0]]);
    play(t, 'third', [[4, 0]]);
    b = resolveBracket(t)!;
    expect(bracketDone(b)).toBe(true);
    t.status = 'finished';
    expect(finalPlacings(t).map((x) => x.playerId)).toEqual(['Миша', 'Весна', 'Ульяна', 'Варя', 'Крис', 'Марина', 'Ярослав', 'Петр']);
    expect(playerRecord(t, 'Миша')).toMatchObject({ wins: 5, losses: 0, gamesFor: 20, gamesAgainst: 1 });
    expect(seasonRating([t], '2026', {})[0]).toMatchObject({ playerId: 'Миша', points: 100, titles: 1 });
  });

  it('3 группы, 4 места → победители + лучший второй, одногруппники разведены', () => {
    const t = mk({ A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'], C: ['c1', 'c2', 'c3'] });
    const sc: Record<string, [number, number]> = { a: [4, 0], b: [4, 2], c: [4, 3] };
    for (const m of Object.values(t.matches)) m.sets = [{ a: sc[m.p1[0]][0], b: sc[m.p1[0]][1] }];
    t.matches.M001.sets = [{ a: 4, b: 3 }]; // a2 — лучший второй
    t.playoff = seedBracket(t)!;
    expect(t.playoff.slots).toEqual(['a1', 'c1', 'b1', 'a2']);
  });

  it('4 группы, 8 мест → 1/4 финала, одногруппники только в финале', () => {
    const groups = { A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'], C: ['c1', 'c2', 'c3'], D: ['d1', 'd2', 'd3'] };
    const t = mk(groups, { playoffSize: 8 });
    for (const m of Object.values(t.matches)) m.sets = [{ a: 4, b: 1 }]; // в каждой группе 1 > 2 > 3
    const p = seedBracket(t)!;
    expect(p.size).toBe(8);
    const pos = (id: string) => p.slots.indexOf(id);
    for (const g of 'abcd') expect(meetingRound(pos(g + '1'), pos(g + '2'))).toBe(3);
  });

  it('6 участников → сетка на 8, BYE у первых двух посевов', () => {
    const t = mk({ A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] }, { playoffSize: 6 });
    for (const m of Object.values(t.matches)) m.sets = [{ a: 4, b: 1 }];
    t.playoff = seedBracket(t)!;
    expect(t.playoff.slots.filter((s) => s == null)).toHaveLength(2);
    const b = resolveBracket(t)!;
    const byeWinners = b.rounds[0].filter((m) => m.bye1 || m.bye2).map((m) => m.winner);
    expect(byeWinners.sort()).toEqual(['a1', 'b1']);
    expect(b.rounds[1].flatMap((m) => [m.p1, m.p2]).filter(Boolean).sort()).toEqual(['a1', 'b1']);
  });

  it('без матча за 3 место проигравшие в 1/2 делят 3 место', () => {
    const t = excelTournament();
    t.thirdPlace = false;
    t.playoff = seedBracket(t)!;
    expect(t.playoff.matches.third).toBeUndefined();
    play(t, 'r1m0', [[4, 0]]);
    play(t, 'r1m1', [[4, 1]]);
    play(t, 'r2m0', [[4, 0]]);
    const pl = finalPlacings(t);
    expect(pl.slice(0, 4).map((x) => x.place)).toEqual([1, 2, 3, 3]);
    expect(pl[4].place).toBe(5);
  });

  it('какие матчи сбросить при смене победителя', () => {
    const t = mk({ A: ['a', 'b', 'c', 'd'], B: ['e', 'f', 'g', 'h'] }, { playoffSize: 8 });
    const p = seedBracket(t)!;
    expect(downstreamMatches(p, 'r1m3')).toEqual(['r2m1', 'r3m0', 'third']);
    expect(downstreamMatches(p, 'r3m0')).toEqual([]);
  });
});

describe('старые данные', () => {
  it('g1/g2 и SF1/FINAL читаются как сеты и сетка', () => {
    const t = normalizeTournament('x', {
      name: 'Старый', date: '2026-10-01', season: '2026', status: 'playoff',
      groups: { A: ['a', 'b'], B: ['c', 'd'] },
      matches: { M001: { group: 'A', p1: 'a', p2: 'b', g1: 5, g2: 0, order: 1 } },
      playoff: { SF1: { p1: 'a', p2: 'd', g1: 5, g2: 0 }, SF2: { p1: 'c', p2: 'b', g1: 4, g2: 1 }, THIRD: { g1: null, g2: null }, FINAL: { g1: null, g2: null } },
      playerNames: {},
    });
    expect(t.bestOf).toBe(1);
    expect(t.playoffSize).toBe(4);
    expect(t.matches.M001.sets).toEqual([{ a: 5, b: 0 }]);
    expect(t.legacyPlayoff).toBe(true);
    const b = resolveBracket(t)!;
    expect([b.final.p1, b.final.p2]).toEqual(['a', 'c']);
    expect([b.third!.p1, b.third!.p2]).toEqual(['d', 'b']);
  });
});

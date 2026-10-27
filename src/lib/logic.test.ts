import { describe, expect, it } from 'vitest';
import type { Tournament } from '../types';
import { allStandings, buildGroupMatches } from './standings';
import { resolvePlayoff, seedSemifinals } from './playoff';
import { finalPlacings, playerRecord, seasonRating } from './results';

// Данные из файла «Теннисный_турнир_пример.xlsx»
function excelTournament(): Tournament {
  const groups = {
    A: ['Варя', 'Марина', 'Петр', 'Миша'],
    B: ['Ярослав', 'Ульяна', 'Крис', 'Весна'],
  };
  const matches = buildGroupMatches(groups);
  const scores: [number, number][] = [
    [4, 1], [4, 1], [1, 4], [4, 2], [0, 4], [0, 4],
    [2, 4], [0, 4], [4, 2], [4, 2], [1, 4], [0, 4],
  ];
  Object.values(matches)
    .sort((a, b) => a.order - b.order)
    .forEach((m, i) => {
      m.g1 = scores[i][0];
      m.g2 = scores[i][1];
    });
  const names = Object.fromEntries([...groups.A, ...groups.B].map((n) => [n, n]));
  return {
    id: 't1', name: 'Пример', date: '2026-10-20', season: '2026', status: 'groups',
    groups, matches, playoff: null, playerNames: names, createdAt: 0,
  };
}

describe('логика как в Excel', () => {
  it('строит 12 матчей в порядке Excel', () => {
    const t = excelTournament();
    const m = Object.values(t.matches).sort((a, b) => a.order - b.order);
    expect(m).toHaveLength(12);
    expect([m[0].p1, m[0].p2]).toEqual(['Варя', 'Марина']);
    expect([m[5].p1, m[5].p2]).toEqual(['Петр', 'Миша']);
    expect(m[6].id).toBe('M007');
  });

  it('таблицы групп совпадают с Excel', () => {
    const st = allStandings(excelTournament());
    expect(st.A.map((r) => [r.playerId, r.wins, r.diff])).toEqual([
      ['Миша', 3, 11], ['Варя', 2, 3], ['Марина', 1, -5], ['Петр', 0, -9],
    ]);
    expect(st.B.map((r) => [r.playerId, r.wins, r.diff, r.gamesFor])).toEqual([
      ['Весна', 2, 5, 10], ['Ульяна', 2, 1, 9], ['Крис', 1, -2, 6], ['Ярослав', 1, -4, 6],
    ]);
  });

  it('плей-офф и итоговые места как в Excel', () => {
    const t = excelTournament();
    const sf = seedSemifinals(t)!;
    expect([sf.SF1.p1, sf.SF1.p2]).toEqual(['Миша', 'Ульяна']);
    expect([sf.SF2.p1, sf.SF2.p2]).toEqual(['Весна', 'Варя']);
    sf.SF1.g1 = 4; sf.SF1.g2 = 0;
    sf.SF2.g1 = 4; sf.SF2.g2 = 1;
    t.playoff = sf;
    const p = resolvePlayoff(sf);
    expect([p.FINAL.p1, p.FINAL.p2]).toEqual(['Миша', 'Весна']);
    expect([p.THIRD.p1, p.THIRD.p2]).toEqual(['Ульяна', 'Варя']);
    t.playoff.FINAL = { g1: 4, g2: 0 };
    t.playoff.THIRD = { g1: 4, g2: 0 };
    t.status = 'finished';
    expect(finalPlacings(t).map((x) => x.playerId)).toEqual([
      'Миша', 'Весна', 'Ульяна', 'Варя', 'Крис', 'Марина', 'Ярослав', 'Петр',
    ]);
    expect(playerRecord(t, 'Миша')).toEqual({ wins: 5, losses: 0, gamesFor: 20, gamesAgainst: 1 });
    const rating = seasonRating([t], '2026', {});
    expect(rating[0]).toMatchObject({ playerId: 'Миша', points: 100, titles: 1 });
    expect(rating).toHaveLength(8);
  });

  it('3 группы: победители + лучший второй, без повторной встречи из одной группы', () => {
    const t = excelTournament();
    const groups = { A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'], C: ['c1', 'c2', 'c3'] };
    t.groups = groups;
    t.matches = buildGroupMatches(groups);
    // в каждой группе 1-й обыгрывает всех, 2-й обыгрывает 3-го
    const sc: Record<string, [number, number]> = { a: [4, 0], b: [4, 2], c: [4, 3] };
    for (const m of Object.values(t.matches)) {
      const s = sc[m.p1[0]];
      m.g1 = s[0]; m.g2 = s[1];
    }
    t.matches.M001.g1 = 4; t.matches.M001.g2 = 3; // a2 берёт 3 гейма у a1 → лучший второй
    const sf = seedSemifinals(t)!;
    // a1 лучший победитель, лучший второй тоже a2 → a1 играет с c1, b1 с a2
    expect([sf.SF1.p1, sf.SF1.p2]).toEqual(['a1', 'c1']);
    expect([sf.SF2.p1, sf.SF2.p2]).toEqual(['b1', 'a2']);
  });

  it('ничья не считается сыгранным матчем', () => {
    const t = excelTournament();
    t.matches.M001.g1 = 2; t.matches.M001.g2 = 2;
    expect(allStandings(t).A.find((r) => r.playerId === 'Варя')!.played).toBe(2);
  });
});

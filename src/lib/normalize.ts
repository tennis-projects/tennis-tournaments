import type { BestOf, GroupMatch, SetScore, Tournament } from '../types';
import { convertLegacyPlayoff } from './playoff';
import { activeGroups } from './standings';

type Raw = Record<string, unknown>;

/**
 * Приводит документ турнира из базы к текущему формату.
 * Турниры, созданные до перехода на сеты, хранили счёт как g1/g2 (один сет в геймах)
 * и плей-офф как SF1/SF2/THIRD/FINAL. Они продолжают открываться и редактироваться.
 */
export function normalizeTournament(id: string, raw: Raw): Tournament {
  const matches: Record<string, GroupMatch> = {};
  const rawMatches = (raw.matches ?? {}) as Record<string, Raw>;
  for (const [mid, m] of Object.entries(rawMatches)) {
    let sets = m.sets as SetScore[] | undefined;
    if (sets === undefined) {
      sets = m.g1 != null && m.g2 != null ? [{ a: m.g1 as number, b: m.g2 as number }] : [];
    }
    matches[mid] = {
      id: mid,
      group: m.group as GroupMatch['group'],
      p1: m.p1 as string,
      p2: m.p2 as string,
      order: (m.order as number) ?? 0,
      sets,
    };
  }

  const groups = (raw.groups ?? {}) as Tournament['groups'];
  let playoff = (raw.playoff ?? null) as Tournament['playoff'];
  let legacyPlayoff = false;
  if (playoff && 'SF1' in (playoff as object)) {
    playoff = convertLegacyPlayoff(playoff as unknown as Parameters<typeof convertLegacyPlayoff>[0]);
    legacyPlayoff = true;
  }

  return {
    id,
    name: (raw.name as string) ?? '',
    date: (raw.date as string) ?? '',
    season: (raw.season as string) ?? '',
    status: (raw.status as Tournament['status']) ?? 'groups',
    bestOf: ((raw.bestOf as BestOf) ?? 1) === 3 ? 3 : 1,
    playoffSize: (raw.playoffSize as number) ?? (activeGroups({ groups }).length >= 2 ? 4 : 0),
    thirdPlace: (raw.thirdPlace as boolean) ?? true,
    groups,
    matches,
    playoff,
    playerNames: (raw.playerNames ?? {}) as Record<string, string>,
    createdAt: (raw.createdAt as number) ?? 0,
    legacyPlayoff,
  };
}

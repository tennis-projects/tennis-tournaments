import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { downstreamMatches, resolveBracket } from './lib/playoff';
import { buildGroupMatches } from './lib/standings';
import type { BestOf, GroupKey, SetScore, StoredPlayoff, Tournament, TournamentStatus } from './types';

const playersCol = collection(db, 'players');
const tournamentsCol = collection(db, 'tournaments');

// ── Игроки ────────────────────────────────────────────────
export async function addPlayer(name: string, birthYear: number | null) {
  const ref = await addDoc(playersCol, { name: name.trim(), birthYear, createdAt: Date.now() });
  return ref.id;
}

export function updatePlayer(id: string, data: { name: string; birthYear: number | null }) {
  return updateDoc(doc(db, 'players', id), { name: data.name.trim(), birthYear: data.birthYear });
}

export function deletePlayer(id: string) {
  return deleteDoc(doc(db, 'players', id));
}

// ── Турниры ───────────────────────────────────────────────
export async function createTournament(input: {
  name: string;
  date: string;
  season: string;
  bestOf: BestOf;
  playoffSize: number;
  thirdPlace: boolean;
  groups: Partial<Record<GroupKey, string[]>>;
  playerNames: Record<string, string>;
}) {
  const data: Omit<Tournament, 'id'> = {
    name: input.name.trim(),
    date: input.date,
    season: input.season.trim(),
    status: 'groups',
    bestOf: input.bestOf,
    playoffSize: input.playoffSize,
    thirdPlace: input.thirdPlace,
    groups: input.groups,
    matches: buildGroupMatches(input.groups),
    playoff: null,
    playerNames: input.playerNames,
    createdAt: Date.now(),
  };
  const ref = await addDoc(tournamentsCol, data);
  return ref.id;
}

export function updateTournamentInfo(
  id: string,
  data: Partial<Pick<Tournament, 'name' | 'date' | 'season' | 'bestOf' | 'playoffSize' | 'thirdPlace'>>,
) {
  return updateDoc(doc(db, 'tournaments', id), data);
}

export function deleteTournament(id: string) {
  return deleteDoc(doc(db, 'tournaments', id));
}

/** Пишем только сеты одного матча — два админа могут вводить счёт одновременно без конфликтов. */
export function setGroupScore(tid: string, matchId: string, sets: SetScore[]) {
  return updateDoc(doc(db, 'tournaments', tid), { [`matches.${matchId}.sets`]: sets });
}

export function startPlayoff(tid: string, playoff: StoredPlayoff) {
  return updateDoc(doc(db, 'tournaments', tid), { playoff, status: 'playoff' satisfies TournamentStatus });
}

export function cancelPlayoff(tid: string) {
  return updateDoc(doc(db, 'tournaments', tid), { playoff: null, status: 'groups' satisfies TournamentStatus });
}

/** Какие следующие матчи потеряют счёт, если сохранить такой результат (сменится победитель). */
export function playoffMatchesToReset(t: Tournament, matchId: string, sets: SetScore[]): string[] {
  if (!t.playoff) return [];
  const before = resolveBracket(t);
  const next = { ...t, playoff: { ...t.playoff, matches: { ...t.playoff.matches, [matchId]: { sets } } } };
  const after = resolveBracket(next);
  const find = (b: typeof before) => [...(b?.rounds.flat() ?? []), ...(b?.third ? [b.third] : [])].find((m) => m.id === matchId);
  if (find(before)?.winner === find(after)?.winner) return [];
  return downstreamMatches(t.playoff, matchId).filter((id) => (t.playoff!.matches[id]?.sets.length ?? 0) > 0);
}

export function setPlayoffScore(t: Tournament, matchId: string, sets: SetScore[]) {
  const reset = playoffMatchesToReset(t, matchId, sets);
  if (t.legacyPlayoff && t.playoff) {
    // старый формат хранения — переписываем плей-офф целиком в новом виде
    const matches = { ...t.playoff.matches, [matchId]: { sets } };
    for (const id of reset) matches[id] = { sets: [] };
    return updateDoc(doc(db, 'tournaments', t.id), { playoff: { ...t.playoff, matches } });
  }
  const upd: Record<string, SetScore[]> = { [`playoff.matches.${matchId}.sets`]: sets };
  for (const id of reset) upd[`playoff.matches.${id}.sets`] = [];
  return updateDoc(doc(db, 'tournaments', t.id), upd);
}

export function setStatus(tid: string, status: TournamentStatus) {
  return updateDoc(doc(db, 'tournaments', tid), { status });
}

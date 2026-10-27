import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { GroupKey, PlayoffSlot, StoredPlayoff, Tournament, TournamentStatus } from './types';
import { buildGroupMatches } from './lib/standings';

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
  groups: Partial<Record<GroupKey, string[]>>;
  playerNames: Record<string, string>;
}) {
  const data: Omit<Tournament, 'id'> = {
    name: input.name.trim(),
    date: input.date,
    season: input.season.trim(),
    status: 'groups',
    groups: input.groups,
    matches: buildGroupMatches(input.groups),
    playoff: null,
    playerNames: input.playerNames,
    createdAt: Date.now(),
  };
  const ref = await addDoc(tournamentsCol, data);
  return ref.id;
}

export function updateTournamentInfo(id: string, data: { name: string; date: string; season: string }) {
  return updateDoc(doc(db, 'tournaments', id), data);
}

export function deleteTournament(id: string) {
  return deleteDoc(doc(db, 'tournaments', id));
}

/** Обновляем только одно поле матча — два админа могут вводить счёт одновременно без конфликтов. */
export function setGroupScore(tid: string, matchId: string, g1: number | null, g2: number | null) {
  return updateDoc(doc(db, 'tournaments', tid), {
    [`matches.${matchId}.g1`]: g1,
    [`matches.${matchId}.g2`]: g2,
  });
}

export function startPlayoff(tid: string, playoff: StoredPlayoff) {
  return updateDoc(doc(db, 'tournaments', tid), { playoff, status: 'playoff' satisfies TournamentStatus });
}

export function cancelPlayoff(tid: string) {
  return updateDoc(doc(db, 'tournaments', tid), { playoff: null, status: 'groups' satisfies TournamentStatus });
}

export function setPlayoffScore(tid: string, slot: PlayoffSlot, g1: number | null, g2: number | null) {
  return updateDoc(doc(db, 'tournaments', tid), {
    [`playoff.${slot}.g1`]: g1,
    [`playoff.${slot}.g2`]: g2,
  });
}

export function setStatus(tid: string, status: TournamentStatus) {
  return updateDoc(doc(db, 'tournaments', tid), { status });
}

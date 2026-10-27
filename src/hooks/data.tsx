import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, db, firebaseConfigured } from '../firebase';
import type { Player, Tournament } from '../types';

interface DataState {
  user: User | null;
  isAdmin: boolean;
  /** подпись роли из поля role документа admins/{uid}: 'coach' → тренер, иначе админ */
  role: 'admin' | 'coach' | null;
  authReady: boolean;
  players: Player[];
  playerNames: Record<string, string>;
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<DataState | null>(null);

/**
 * Одна живая подписка на игроков и турниры на всё приложение.
 * Изменения, внесённые админом, сразу появляются у родителей без перезагрузки.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<'admin' | 'coach' | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loaded, setLoaded] = useState({ p: false, t: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'admins', u.uid));
          setIsAdmin(snap.exists());
          setRole(snap.exists() ? (snap.data().role === 'coach' ? 'coach' : 'admin') : null);
        } catch {
          setIsAdmin(false);
          setRole(null);
        }
      } else {
        setIsAdmin(false);
        setRole(null);
      }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const onErr = (e: Error) => setError(e.message);
    const unP = onSnapshot(
      query(collection(db, 'players'), orderBy('name')),
      (s) => {
        setPlayers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Player, 'id'>) })));
        setLoaded((l) => ({ ...l, p: true }));
      },
      onErr,
    );
    const unT = onSnapshot(
      query(collection(db, 'tournaments'), orderBy('date', 'desc')),
      (s) => {
        setTournaments(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Tournament, 'id'>) })));
        setLoaded((l) => ({ ...l, t: true }));
      },
      onErr,
    );
    return () => {
      unP();
      unT();
    };
  }, []);

  const value = useMemo<DataState>(
    () => ({
      user,
      isAdmin,
      role,
      authReady,
      players,
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      tournaments,
      loading: firebaseConfigured && !(loaded.p && loaded.t) && !error,
      error,
    }),
    [user, isAdmin, role, authReady, players, tournaments, loaded, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData вне DataProvider');
  return v;
}

/** Имя игрока: текущее из базы, иначе сохранённое в турнире. */
export function useNameOf(t?: Tournament) {
  const { playerNames } = useData();
  return (id: string | null | undefined) => (id ? playerNames[id] ?? t?.playerNames[id] ?? '—' : '—');
}
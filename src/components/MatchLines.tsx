import type { BestOf, SetScore } from '../types';
import { matchState } from '../lib/score';

interface Props {
  p1: string | null;
  p2: string | null;
  bye1?: boolean;
  bye2?: boolean;
  name: (id: string | null) => string;
  sets: SetScore[];
  bestOf: BestOf;
  /** показывать пустые клетки под несыгранные сеты */
  reserveSets?: boolean;
  compact?: boolean;
}

/**
 * Две строки «игрок + счёт по сетам», как в теннисной сетке:
 *   ● Варя     6  6
 *     Миша     3  4
 */
export default function MatchLines({ p1, p2, bye1, bye2, name, sets, bestOf, reserveSets, compact }: Props) {
  const st = matchState(sets, bestOf);
  const cols = reserveSets ? Math.max(sets.length, bestOf) : sets.length;

  const line = (side: 1 | 2) => {
    const id = side === 1 ? p1 : p2;
    const bye = side === 1 ? bye1 : bye2;
    const won = st.winner === side;
    const lost = st.winner != null && !won;
    return (
      <div className={`flex items-center gap-2 ${compact ? 'h-6' : 'h-7'}`}>
        <span className="w-2 shrink-0">
          {won && <span className="block w-2 h-2 rounded-full bg-ball border border-court-700" />}
        </span>
        <span className={`flex-1 min-w-0 truncate ${won ? 'font-bold text-court-900' : lost ? 'text-muted' : ''}`}>
          {id ? name(id) : bye ? <span className="text-muted tracking-wider text-xs">BYE</span> : <span className="text-muted">—</span>}
        </span>
        {Array.from({ length: cols }, (_, i) => {
          const s = sets[i];
          const v = s ? (side === 1 ? s.a : s.b) : null;
          const other = s ? (side === 1 ? s.b : s.a) : null;
          const setWon = v != null && other != null && v > other;
          return (
            <span
              key={i}
              className={`w-5 text-center tabular-nums ${compact ? 'text-xs' : 'text-sm'} ${
                v == null ? 'text-line' : setWon ? 'font-bold text-ink' : 'text-muted'
              }`}
            >
              {v ?? '·'}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className={compact ? 'text-[13px] leading-tight' : 'text-sm leading-tight'}>
      {line(1)}
      {line(2)}
    </div>
  );
}

export function StatusPill({ sets, bestOf, ready = true }: { sets: SetScore[]; bestOf: BestOf; ready?: boolean }) {
  const st = matchState(sets, bestOf);
  if (!ready) return <span className="text-[11px] text-muted">ждёт соперника</span>;
  if (st.complete) return <span className="text-[11px] font-semibold text-court-600">Окончен</span>;
  if (st.started) return <span className="text-[11px] font-semibold text-clay-600">Идёт</span>;
  return <span className="text-[11px] text-muted">Не сыгран</span>;
}

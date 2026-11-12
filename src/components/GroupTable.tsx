import { Link } from 'react-router';
import type { BestOf, GroupMatch } from '../types';
import type { StandingRow } from '../lib/standings';
import { formatSets, matchState } from '../lib/score';

interface Props {
  group: string;
  /** игроки в исходном порядке группы — по нему нумеруются столбцы */
  order: string[];
  rows: StandingRow[];
  matches: GroupMatch[];
  bestOf: BestOf;
  name: (id: string) => string;
  qualified: Set<string>;
  onOpen: (matchId: string) => void;
}

/**
 * Шахматка группы: по строкам игроки (по местам), по столбцам — соперники (по номеру в группе).
 * В клетке счёт по сетам со стороны игрока строки. Справа — матчи, сеты, геймы.
 */
export default function GroupTable({ group, order, rows, matches, bestOf, name, qualified, onOpen }: Props) {
  const num = new Map(order.map((id, i) => [id, i + 1]));
  const cell = (row: string, col: string) => {
    if (row === col) return <td key={col} className="bg-paper border-l border-line" />;
    const m = matches.find((x) => (x.p1 === row && x.p2 === col) || (x.p1 === col && x.p2 === row));
    if (!m) return <td key={col} className="border-l border-line" />;
    const flip = m.p2 === row;
    const st = matchState(m.sets, bestOf);
    const won = st.winner != null && (st.winner === 1) !== flip;
    return (
      <td key={col} className="border-l border-line p-0">
        <button
          onClick={() => onOpen(m.id)}
          className={`w-full h-full min-h-10 px-2 py-2 text-center whitespace-nowrap hover:bg-court-50 transition text-[13px] ${
            !st.started ? 'text-line' : !st.complete ? 'text-clay-600' : won ? 'font-semibold text-ink' : 'text-muted'
          }`}
          title={`${name(row)} — ${name(col)}`}
        >
          {st.started ? formatSets(m.sets, flip) + (st.complete ? '' : ' …') : '—'}
        </button>
      </td>
    );
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2.5 bg-court-50 flex items-center justify-between">
        <h3 className="font-display font-bold text-court-700">Группа {group}</h3>
        {qualified.size > 0 && (
          <span className="text-[11px] text-muted flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-ball border border-court-700" /> в плей-офф
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums border-collapse">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th className="text-left font-semibold pl-4 pr-2 py-2 w-8 sticky left-0 bg-white">№</th>
              <th className="text-left font-semibold py-2 pr-3 sticky left-10 bg-white">Игрок</th>
              {order.map((id, i) => (
                <th key={id} className="font-semibold px-2 border-l border-line min-w-16" title={name(id)}>
                  {i + 1}
                </th>
              ))}
              <th className="font-semibold px-2 border-l border-line" title="Победы – поражения">Матчи</th>
              <th className="font-semibold px-2" title="Выиграно – проиграно сетов">Сеты</th>
              <th className="font-semibold px-2 pr-4" title="Выиграно – проиграно геймов">Геймы</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId} className="border-t border-line">
                <td className="pl-4 pr-2 py-1.5 sticky left-0 bg-white">
                  <span
                    className={`inline-grid place-items-center w-6 h-6 rounded-full text-xs font-bold ${
                      qualified.has(r.playerId) ? 'bg-ball text-court-900' : 'text-muted'
                    }`}
                  >
                    {r.place}
                  </span>
                </td>
                <td className="py-1.5 pr-3 font-semibold whitespace-nowrap sticky left-10 bg-white">
                  <span className="text-muted font-normal text-xs mr-1.5">{num.get(r.playerId)}</span>
                  <Link to={`/players/${r.playerId}`} className="hover:underline">
                    {name(r.playerId)}
                  </Link>
                </td>
                {order.map((col) => cell(r.playerId, col))}
                <td className="text-center px-2 border-l border-line font-bold whitespace-nowrap">
                  {r.wins} – {r.losses}
                </td>
                <td className="text-center px-2 whitespace-nowrap">
                  {r.setsFor} – {r.setsAgainst}
                </td>
                <td className="text-center px-2 pr-4 whitespace-nowrap">
                  {r.gamesFor} – {r.gamesAgainst}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

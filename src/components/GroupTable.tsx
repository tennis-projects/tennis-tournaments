import { Link } from 'react-router';
import type { StandingRow } from '../lib/standings';

interface Props {
  group: string;
  rows: StandingRow[];
  name: (id: string) => string;
  qualifyCount: number;
}

export default function GroupTable({ group, rows, name, qualifyCount }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2.5 bg-court-50 flex items-center justify-between">
        <h3 className="font-display font-bold text-court-700">Группа {group}</h3>
        {qualifyCount > 0 && (
          <span className="text-[11px] text-muted flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-ball border border-court-700" /> в плей-офф
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th className="text-left font-semibold pl-4 py-2 w-8">#</th>
              <th className="text-left font-semibold py-2">Игрок</th>
              <th className="font-semibold px-1.5" title="Сыграно матчей">И</th>
              <th className="font-semibold px-1.5" title="Победы">В</th>
              <th className="font-semibold px-1.5" title="Поражения">П</th>
              <th className="font-semibold px-1.5" title="Геймы выигранные – проигранные">Геймы</th>
              <th className="font-semibold px-1.5 pr-4" title="Разница геймов">±</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId} className="border-t border-line">
                <td className="pl-4 py-2">
                  <span
                    className={`inline-grid place-items-center w-6 h-6 rounded-full text-xs font-bold ${
                      r.place <= qualifyCount ? 'bg-ball text-court-900' : 'text-muted'
                    }`}
                  >
                    {r.place}
                  </span>
                </td>
                <td className="py-2 font-semibold">
                  <Link to={`/players/${r.playerId}`} className="hover:underline">
                    {name(r.playerId)}
                  </Link>
                </td>
                <td className="text-center px-1.5">{r.played}</td>
                <td className="text-center px-1.5 font-bold">{r.wins}</td>
                <td className="text-center px-1.5">{r.losses}</td>
                <td className="text-center px-1.5 whitespace-nowrap">
                  {r.gamesFor}–{r.gamesAgainst}
                </td>
                <td className={`text-center px-1.5 pr-4 font-semibold ${r.diff > 0 ? 'text-court-600' : r.diff < 0 ? 'text-clay-600' : ''}`}>
                  {r.diff > 0 ? '+' : ''}
                  {r.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

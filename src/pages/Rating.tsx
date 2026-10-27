import { useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../hooks/data';
import { PARTICIPATION_POINTS, RATING_POINTS, seasonRating } from '../lib/results';

export default function Rating() {
  const { tournaments, playerNames } = useData();
  const seasons = [...new Set(tournaments.map((t) => t.season))].sort((a, b) => b.localeCompare(a));
  const [season, setSeason] = useState(seasons[0] ?? '');
  const current = seasons.includes(season) ? season : seasons[0] ?? '';
  const rows = seasonRating(tournaments, current, playerNames);
  const finishedCount = tournaments.filter((t) => t.season === current && t.status === 'finished').length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold">Рейтинг сезона</h1>
          <p className="text-sm text-muted mt-1">Учитываются завершённые турниры: {finishedCount}</p>
        </div>
        {seasons.length > 0 && (
          <select className="field w-auto" value={current} onChange={(e) => setSeason(e.target.value)}>
            {seasons.map((s) => (
              <option key={s} value={s}>
                Сезон {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-muted">В этом сезоне ещё нет завершённых турниров.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted bg-court-50">
                <th className="text-left font-semibold pl-4 py-2 w-10">#</th>
                <th className="text-left font-semibold py-2">Игрок</th>
                <th className="font-semibold px-2">Очки</th>
                <th className="font-semibold px-2" title="Сыграно турниров">Турн.</th>
                <th className="font-semibold px-2" title="Победы в турнирах">🏆</th>
                <th className="font-semibold px-2" title="Победы–поражения в матчах">В–П</th>
                <th className="font-semibold px-2 pr-4" title="Лучшее место">Лучшее</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.playerId} className="border-t border-line">
                  <td className="pl-4 py-2.5">
                    <span
                      className={`inline-grid place-items-center w-7 h-7 rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-ball text-court-900' : i < 3 ? 'bg-court-100 text-court-700' : 'text-muted'
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 font-semibold">
                    <Link to={`/players/${r.playerId}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="text-center px-2 font-display font-bold text-court-700">{r.points}</td>
                  <td className="text-center px-2">{r.tournaments}</td>
                  <td className="text-center px-2">{r.titles || '—'}</td>
                  <td className="text-center px-2 whitespace-nowrap">
                    {r.wins}–{r.losses}
                  </td>
                  <td className="text-center px-2 pr-4">{r.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="mt-4 text-sm text-muted">
        <summary className="cursor-pointer">Как начисляются очки</summary>
        <div className="mt-2 card p-4 text-ink">
          <p className="mb-2">За итоговое место в каждом завершённом турнире:</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {RATING_POINTS.map((p, i) => (
              <span key={i} className="rounded-lg bg-court-50 px-2 py-1 text-xs">
                {i + 1} место — <b>{p}</b>
              </span>
            ))}
            <span className="rounded-lg bg-court-50 px-2 py-1 text-xs">
              ниже — <b>{PARTICIPATION_POINTS}</b> за участие
            </span>
          </div>
          <p className="text-muted text-xs">
            При равенстве очков выше тот, у кого больше титулов, затем больше побед в матчах, затем лучше разница геймов.
          </p>
        </div>
      </details>
    </div>
  );
}

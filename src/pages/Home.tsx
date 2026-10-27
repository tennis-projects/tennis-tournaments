import { Link } from 'react-router';
import StatusBadge, { formatDate } from '../components/StatusBadge';
import { useData, useNameOf } from '../hooks/data';
import { finalPlacings, tournamentPlayerIds } from '../lib/results';
import type { Tournament } from '../types';

export default function Home() {
  const { tournaments, isAdmin } = useData();

  const bySeason = new Map<string, Tournament[]>();
  for (const t of tournaments) {
    const list = bySeason.get(t.season) ?? [];
    list.push(t);
    bySeason.set(t.season, list);
  }
  const seasons = [...bySeason.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Турниры</h1>
          <p className="text-muted text-sm mt-1">Группы, счёт и сетка обновляются в реальном времени</p>
        </div>
        {isAdmin && (
          <Link to="/new" className="btn btn-primary shrink-0">
            + Новый турнир
          </Link>
        )}
      </div>

      {tournaments.length === 0 && (
        <div className="card p-8 text-center text-muted">
          Пока нет ни одного турнира.
          {isAdmin && ' Нажмите «Новый турнир», чтобы создать первый.'}
        </div>
      )}

      {seasons.map((s) => (
        <section key={s} className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Сезон {s}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {bySeason.get(s)!.map((t) => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TournamentCard({ t }: { t: Tournament }) {
  const name = useNameOf(t);
  const winner = t.status === 'finished' ? finalPlacings(t)[0] : null;
  return (
    <Link to={`/t/${t.id}`} className="card p-4 block hover:border-court-200 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold truncate">{t.name}</div>
          <div className="text-sm text-muted">
            {formatDate(t.date)} · {tournamentPlayerIds(t).length} игроков
          </div>
        </div>
        <StatusBadge status={t.status} />
      </div>
      {winner && (
        <div className="mt-3 text-sm flex items-center gap-2">
          <span className="text-base">🏆</span>
          <span className="font-semibold">{name(winner.playerId)}</span>
        </div>
      )}
    </Link>
  );
}

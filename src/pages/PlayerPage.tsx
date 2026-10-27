import { Link, useParams } from 'react-router';
import { formatDate } from '../components/StatusBadge';
import { useData } from '../hooks/data';
import { resolvePlayoff, PLAYOFF_LABELS } from '../lib/playoff';
import { finalPlacings, playerRecord, pointsForPlace, tournamentPlayerIds } from '../lib/results';
import { isPlayed, sortedMatches, winnerSide } from '../lib/standings';
import type { Tournament } from '../types';

export default function PlayerPage() {
  const { id = '' } = useParams();
  const { players, tournaments, playerNames } = useData();
  const player = players.find((p) => p.id === id);
  const mine = tournaments.filter((t) => tournamentPlayerIds(t).includes(id));
  const displayName = player?.name ?? mine[0]?.playerNames[id] ?? 'Игрок';
  const nm = (t: Tournament, pid: string | null) => (pid ? playerNames[pid] ?? t.playerNames[pid] ?? '—' : '—');

  let wins = 0,
    losses = 0,
    titles = 0,
    podiums = 0;
  const rows = mine.map((t) => {
    const rec = playerRecord(t, id);
    const pl = finalPlacings(t).find((x) => x.playerId === id);
    const done = t.status === 'finished';
    wins += rec.wins;
    losses += rec.losses;
    if (done && pl?.place === 1) titles++;
    if (done && pl && pl.place <= 3) podiums++;
    return { t, rec, place: pl?.place, done };
  });

  return (
    <div>
      <Link to="/players" className="text-sm text-muted hover:text-ink">
        ← Все игроки
      </Link>
      <h1 className="font-display text-2xl font-bold mt-2">{displayName}</h1>
      {player?.birthYear ? <p className="text-muted text-sm">{player.birthYear} г.р.</p> : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
        <Stat label="Турниров" value={mine.length} />
        <Stat label="Победы–поражения" value={`${wins}–${losses}`} />
        <Stat label="Титулов" value={titles} />
        <Stat label="Призовых мест" value={podiums} />
      </div>

      <h2 className="font-bold mb-3">История</h2>
      {rows.length === 0 && <p className="text-muted text-sm">Ещё не участвовал(а) в турнирах.</p>}
      <div className="space-y-3">
        {rows.map(({ t, rec, place, done }) => (
          <details key={t.id} className="card group">
            <summary className="list-none cursor-pointer p-4 flex items-center gap-3">
              <span
                className={`w-10 h-10 rounded-full grid place-items-center font-display font-bold shrink-0 ${
                  done && place === 1 ? 'bg-ball text-court-900' : 'bg-court-50 text-court-700'
                }`}
              >
                {place ?? '–'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{t.name}</div>
                <div className="text-xs text-muted">
                  {formatDate(t.date)} · {rec.wins}–{rec.losses} · геймы {rec.gamesFor}–{rec.gamesAgainst}
                  {done && place ? ` · +${pointsForPlace(place)} очк.` : ' · идёт'}
                </div>
              </div>
              <span className="text-muted text-sm group-open:rotate-180 transition">▾</span>
            </summary>
            <div className="px-4 pb-3 text-sm">
              {sortedMatches(t)
                .filter((m) => m.p1 === id || m.p2 === id)
                .map((m) => (
                  <MatchLine key={m.id} label={`Гр. ${m.group}`} me={id} p1={m.p1} p2={m.p2} g1={m.g1} g2={m.g2} nm={(x) => nm(t, x)} />
                ))}
              {t.playoff &&
                Object.values(resolvePlayoff(t.playoff))
                  .filter((m) => m.p1 === id || m.p2 === id)
                  .map((m) => (
                    <MatchLine key={m.slot} label={PLAYOFF_LABELS[m.slot]} me={id} p1={m.p1} p2={m.p2} g1={m.g1} g2={m.g2} nm={(x) => nm(t, x)} />
                  ))}
              <Link to={`/t/${t.id}`} className="inline-block mt-2 text-court-600 hover:underline">
                Открыть турнир →
              </Link>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-3">
      <div className="font-display text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function MatchLine(props: {
  label: string;
  me: string;
  p1: string | null;
  p2: string | null;
  g1: number | null;
  g2: number | null;
  nm: (id: string | null) => string;
}) {
  const { label, me, p1, p2, g1, g2, nm } = props;
  const meFirst = p1 === me;
  const opp = meFirst ? p2 : p1;
  const played = isPlayed({ g1, g2 });
  const w = winnerSide({ g1, g2 });
  const won = played && ((w === 1 && meFirst) || (w === 2 && !meFirst));
  const my = meFirst ? g1 : g2;
  const their = meFirst ? g2 : g1;
  return (
    <div className="flex items-center gap-2 py-1.5 border-t border-line">
      <span className="text-[11px] text-muted w-24 shrink-0 truncate">{label}</span>
      <span className="flex-1 truncate">vs {nm(opp)}</span>
      {played ? (
        <span className={`font-bold tabular-nums ${won ? 'text-court-600' : 'text-clay-600'}`}>
          {won ? 'В' : 'П'} {my}:{their}
        </span>
      ) : (
        <span className="text-muted">—</span>
      )}
    </div>
  );
}

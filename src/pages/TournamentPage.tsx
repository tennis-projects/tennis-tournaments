import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import * as api from '../api';
import GroupTable from '../components/GroupTable';
import { Notice } from '../components/Layout';
import MatchRow from '../components/MatchRow';
import StatusBadge, { formatDate } from '../components/StatusBadge';
import { useData, useNameOf } from '../hooks/data';
import { PLAYOFF_LABELS, resolvePlayoff, seedSemifinals } from '../lib/playoff';
import { finalPlacings, playerRecord, pointsForPlace } from '../lib/results';
import { activeGroups, allGroupMatchesPlayed, allStandings, isPlayed, sortedMatches } from '../lib/standings';
import type { PlayoffSlot, Tournament } from '../types';

type Tab = 'groups' | 'matches' | 'playoff' | 'results';

export default function TournamentPage() {
  const { id } = useParams();
  const { tournaments } = useData();
  const t = tournaments.find((x) => x.id === id);
  if (!t) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted mb-4">Турнир не найден.</p>
        <Link to="/" className="btn btn-ghost">
          ← Все турниры
        </Link>
      </div>
    );
  }
  return <TournamentView key={t.id} t={t} />;
}

function TournamentView({ t }: { t: Tournament }) {
  const { isAdmin } = useData();
  const name = useNameOf(t);
  const groups = activeGroups(t);
  const hasPlayoff = groups.length >= 2;
  const [tab, setTab] = useState<Tab>(t.status === 'finished' ? 'results' : t.status === 'playoff' ? 'playoff' : 'groups');
  const canEdit = isAdmin && t.status !== 'finished';

  const tabs: [Tab, string][] = [
    ['groups', 'Группы'],
    ['matches', 'Матчи'],
    ...(hasPlayoff ? ([['playoff', 'Плей-офф']] as [Tab, string][]) : []),
    ['results', 'Итоги'],
  ];

  return (
    <div>
      <Link to="/" className="text-sm text-muted hover:text-ink">
        ← Все турниры
      </Link>
      <div className="mt-2 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">{t.name}</h1>
          <div className="text-sm text-muted mt-1 flex flex-wrap items-center gap-2">
            {formatDate(t.date)} · сезон {t.season} <StatusBadge status={t.status} />
          </div>
        </div>
      </div>

      {isAdmin && <AdminPanel t={t} />}

      <div className="flex gap-1 mb-4 overflow-x-auto -mx-4 px-4">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
              tab === k ? 'bg-court-700 text-white' : 'bg-white border border-line text-ink hover:bg-court-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'groups' && <GroupsTab t={t} name={name} />}
      {tab === 'matches' && <MatchesTab t={t} name={name} editable={canEdit && t.status === 'groups'} />}
      {tab === 'playoff' && <PlayoffTab t={t} name={name} editable={canEdit} />}
      {tab === 'results' && <ResultsTab t={t} name={name} />}

      {canEdit && t.status === 'playoff' && tab === 'matches' && (
        <p className="text-xs text-muted mt-3">
          Счёт групповых матчей заблокирован, пока идёт плей-офф. Чтобы исправить его, отмените плей-офф в «Управлении турниром» выше.
        </p>
      )}
    </div>
  );
}

type NameFn = (id: string | null | undefined) => string;

function GroupsTab({ t, name }: { t: Tournament; name: NameFn }) {
  const st = allStandings(t);
  const groups = activeGroups(t);
  const qualify = groups.length === 2 ? 2 : groups.length === 3 ? 1 : 0;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => (
        <GroupTable key={g} group={g} rows={st[g]} name={name} qualifyCount={qualify} />
      ))}
      {groups.length === 3 && (
        <p className="text-xs text-muted md:col-span-2">В плей-офф выходят победители групп и лучший из вторых мест.</p>
      )}
      <p className="text-xs text-muted md:col-span-2">
        Места: победы → разница геймов → выигранные геймы → порядок в списке группы.
      </p>
    </div>
  );
}

function MatchesTab({ t, name, editable }: { t: Tournament; name: NameFn; editable: boolean }) {
  const matches = sortedMatches(t);
  const groups = activeGroups(t);
  const played = matches.filter(isPlayed).length;
  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Сыграно {played} из {matches.length}
        {editable && ' · введите геймы и нажмите Enter или перейдите к следующему полю'}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g} className="card px-4 py-1">
            <h3 className="font-display font-bold text-court-700 pt-3 pb-1">Группа {g}</h3>
            {matches
              .filter((m) => m.group === g)
              .map((m) => (
                <MatchRow
                  key={m.id}
                  p1={m.p1}
                  p2={m.p2}
                  name={name}
                  score={m}
                  editable={editable}
                  onSave={(g1, g2) => api.setGroupScore(t.id, m.id, g1, g2)}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayoffTab({ t, name, editable }: { t: Tournament; name: NameFn; editable: boolean }) {
  if (!t.playoff) {
    const preview = seedSemifinals(t);
    return (
      <div className="card p-5">
        <p className="text-muted text-sm mb-3">
          Плей-офф начнётся после группового этапа.
          {preview && ' Если всё останется как сейчас, пары полуфиналов будут такими:'}
        </p>
        {preview && (
          <ul className="text-sm space-y-1">
            <li>
              {name(preview.SF1.p1)} — {name(preview.SF1.p2)}
            </li>
            <li>
              {name(preview.SF2.p1)} — {name(preview.SF2.p2)}
            </li>
          </ul>
        )}
      </div>
    );
  }
  const p = resolvePlayoff(t.playoff);
  const row = (slot: PlayoffSlot) => (
    <MatchRow
      p1={p[slot].p1}
      p2={p[slot].p2}
      name={name}
      score={p[slot]}
      editable={editable}
      onSave={(g1, g2) => api.setPlayoffScore(t.id, slot, g1, g2)}
    />
  );
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-center">
      <div className="space-y-4">
        <Box title={PLAYOFF_LABELS.SF1}>{row('SF1')}</Box>
        <Box title={PLAYOFF_LABELS.SF2}>{row('SF2')}</Box>
      </div>
      <div className="space-y-4">
        <Box title="🏆 Финал" accent>
          {row('FINAL')}
        </Box>
        <Box title={PLAYOFF_LABELS.THIRD}>{row('THIRD')}</Box>
      </div>
    </div>
  );
}

function Box({ title, children, accent }: { title: string; children: ReactNode; accent?: boolean }) {
  return (
    <div className={`card px-4 py-1 ${accent ? 'border-court-500 border-2' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted pt-3">{title}</div>
      {children}
    </div>
  );
}

function ResultsTab({ t, name }: { t: Tournament; name: NameFn }) {
  const placings = finalPlacings(t);
  const done = t.status === 'finished';
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div>
      {!done && <Notice>Турнир ещё идёт — места предварительные. Очки рейтинга начисляются после завершения.</Notice>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted bg-court-50">
              <th className="text-left font-semibold pl-4 pr-3 py-2 w-20">Место</th>
              <th className="text-left font-semibold py-2">Игрок</th>
              <th className="font-semibold px-2" title="Победы–поражения за весь турнир">В–П</th>
              <th className="font-semibold px-2">Геймы</th>
              <th className="font-semibold px-2 pr-4">Очки</th>
            </tr>
          </thead>
          <tbody>
            {placings.map((pl) => {
              const r = playerRecord(t, pl.playerId);
              return (
                <tr key={pl.playerId} className="border-t border-line">
                  <td className="pl-4 py-2.5 font-bold">
                    {done && pl.place <= 3 ? medal[pl.place - 1] : pl.place}
                  </td>
                  <td className="py-2.5 font-semibold">
                    <Link to={`/players/${pl.playerId}`} className="hover:underline">
                      {name(pl.playerId)}
                    </Link>
                  </td>
                  <td className="text-center px-2">
                    {r.wins}–{r.losses}
                  </td>
                  <td className="text-center px-2">
                    {r.gamesFor}–{r.gamesAgainst}
                  </td>
                  <td className="text-center px-2 pr-4 font-bold text-court-700">{done ? pointsForPlace(pl.place) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Управление турниром ─────────────────────────────────────────
function AdminPanel({ t }: { t: Tournament }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const groups = activeGroups(t);
  const hasPlayoff = groups.length >= 2;
  const groupsDone = allGroupMatchesPlayed(t);
  const playoffDone =
    t.playoff != null && (['SF1', 'SF2', 'THIRD', 'FINAL'] as const).every((s) => isPlayed(resolvePlayoff(t.playoff!)[s]));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4 mb-5 border-dashed border-court-200 bg-court-50/50">
      <div className="text-[11px] font-bold uppercase tracking-wider text-court-700 mb-3">Управление турниром</div>

      {editing ? (
        <EditInfo t={t} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {t.status === 'groups' && hasPlayoff && (
            <button
              className="btn btn-primary"
              disabled={busy || !groupsDone}
              title={groupsDone ? '' : 'Сначала введите счёт всех групповых матчей'}
              onClick={() =>
                run(async () => {
                  const sf = seedSemifinals(t);
                  if (!sf) throw new Error('Не удалось построить сетку');
                  await api.startPlayoff(t.id, sf);
                })
              }
            >
              Начать плей-офф →
            </button>
          )}
          {t.status === 'groups' && !hasPlayoff && (
            <button className="btn btn-primary" disabled={busy || !groupsDone} onClick={() => run(() => api.setStatus(t.id, 'finished'))}>
              Завершить турнир
            </button>
          )}
          {t.status === 'playoff' && (
            <>
              <button className="btn btn-primary" disabled={busy || !playoffDone} onClick={() => run(() => api.setStatus(t.id, 'finished'))}>
                Завершить турнир
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() =>
                  confirm('Отменить плей-офф? Счёт полуфиналов и финала будет удалён, групповой этап снова станет редактируемым.') &&
                  run(() => api.cancelPlayoff(t.id))
                }
              >
                Отменить плей-офф
              </button>
            </>
          )}
          {t.status === 'finished' && (
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => run(() => api.setStatus(t.id, t.playoff ? 'playoff' : 'groups'))}
            >
              Открыть для исправлений
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Название и дата
          </button>
          <button
            className="btn btn-danger ml-auto"
            disabled={busy}
            onClick={() =>
              confirm(`Удалить турнир «${t.name}» навсегда? Он исчезнет из истории и рейтинга.`) &&
              run(async () => {
                await api.deleteTournament(t.id);
                navigate('/');
              })
            }
          >
            Удалить
          </button>
        </div>
      )}
      {t.status === 'groups' && hasPlayoff && !groupsDone && !editing && (
        <p className="text-xs text-muted mt-2">«Начать плей-офф» станет доступно, когда будет введён счёт всех групповых матчей.</p>
      )}
      {t.status === 'playoff' && !playoffDone && !editing && (
        <p className="text-xs text-muted mt-2">Завершить турнир можно после финала и матча за 3 место.</p>
      )}
      {err && <p className="text-sm text-clay-600 mt-2">{err}</p>}
    </div>
  );
}

function EditInfo({ t, onDone }: { t: Tournament; onDone: () => void }) {
  const [name, setName] = useState(t.name);
  const [date, setDate] = useState(t.date);
  const [season, setSeason] = useState(t.season);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await api.updateTournamentInfo(t.id, { name: name.trim(), date, season: season.trim() });
        setBusy(false);
        onDone();
      }}
    >
      <label>
        <span className="label">Название</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        <span className="label">Дата</span>
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        <span className="label">Сезон</span>
        <input className="field" value={season} onChange={(e) => setSeason(e.target.value)} required />
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>
          Сохранить
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Отмена
        </button>
      </div>
    </form>
  );
}
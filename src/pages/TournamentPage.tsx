import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import * as api from '../api';
import Bracket from '../components/Bracket';
import GroupTable from '../components/GroupTable';
import { Notice } from '../components/Layout';
import MatchDialog from '../components/MatchDialog';
import MatchLines, { StatusPill } from '../components/MatchLines';
import PlayoffSizeSelect from '../components/PlayoffSizeSelect';
import StatusBadge, { formatDate } from '../components/StatusBadge';
import { useData, useNameOf } from '../hooks/data';
import { bracketDone, qualifiers, resolveBracket, roundName, seedBracket } from '../lib/playoff';
import { finalPlacings, playerRecord, pointsForPlace, tournamentPlayerIds } from '../lib/results';
import { BEST_OF_LABEL, matchState } from '../lib/score';
import { activeGroups, allGroupMatchesPlayed, allStandings, sortedMatches } from '../lib/standings';
import type { BestOf, Tournament } from '../types';

type Tab = 'groups' | 'matches' | 'playoff' | 'results';
type Open = { kind: 'group' | 'playoff'; id: string } | null;
type NameFn = (id: string | null | undefined) => string;

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
  const hasPlayoff = t.playoffSize >= 2;
  const [tab, setTab] = useState<Tab>(t.status === 'finished' ? 'results' : t.status === 'playoff' ? 'playoff' : 'groups');
  const [open, setOpen] = useState<Open>(null);
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
      <div className="mt-2 mb-5">
        <h1 className="font-display text-2xl font-bold leading-tight">{t.name}</h1>
        <div className="text-sm text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {formatDate(t.date)} · сезон {t.season} · {BEST_OF_LABEL[t.bestOf]}
          {hasPlayoff && ` · в плей-офф ${t.playoffSize}`}
          <StatusBadge status={t.status} />
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

      {tab === 'groups' && <GroupsTab t={t} name={name} onOpen={(id) => setOpen({ kind: 'group', id })} />}
      {tab === 'matches' && <MatchesTab t={t} name={name} onOpen={(id) => setOpen({ kind: 'group', id })} />}
      {tab === 'playoff' && <PlayoffTab t={t} name={name} onOpen={(id) => setOpen({ kind: 'playoff', id })} />}
      {tab === 'results' && <ResultsTab t={t} name={name} />}

      {open?.kind === 'group' && <GroupMatchDialog t={t} id={open.id} name={name} canEdit={canEdit} onClose={() => setOpen(null)} />}
      {open?.kind === 'playoff' && <PlayoffMatchDialog t={t} id={open.id} name={name} canEdit={canEdit} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ── Диалоги матчей ──────────────────────────────────────────
function GroupMatchDialog({ t, id, name, canEdit, onClose }: { t: Tournament; id: string; name: NameFn; canEdit: boolean; onClose: () => void }) {
  const m = t.matches[id];
  if (!m) return null;
  const editable = canEdit && t.status === 'groups';
  return (
    <MatchDialog
      title={`Группа ${m.group}`}
      subtitle={t.name}
      p1={m.p1}
      p2={m.p2}
      name={name}
      sets={m.sets}
      bestOf={t.bestOf}
      editable={editable}
      lockedReason={
        canEdit && t.status === 'playoff' ? 'Групповой этап закрыт, идёт плей-офф. Чтобы исправить счёт, отмените плей-офф.' : undefined
      }
      onSave={(sets) => api.setGroupScore(t.id, id, sets)}
      onClose={onClose}
    />
  );
}

function PlayoffMatchDialog({ t, id, name, canEdit, onClose }: { t: Tournament; id: string; name: NameFn; canEdit: boolean; onClose: () => void }) {
  const b = resolveBracket(t);
  const m = b && [...b.rounds.flat(), ...(b.third ? [b.third] : [])].find((x) => x.id === id);
  if (!b || !m) return null;
  return (
    <MatchDialog
      title={m.isThird ? 'Матч за 3 место' : roundName(m.round, b.rounds.length)}
      subtitle={t.name}
      p1={m.p1}
      p2={m.p2}
      name={name}
      sets={m.sets}
      bestOf={t.bestOf}
      editable={canEdit && t.status === 'playoff'}
      onSave={(sets) => api.setPlayoffScore(t, id, sets)}
      confirmText={(sets) => {
        const reset = api.playoffMatchesToReset(t, id, sets);
        return reset.length
          ? `Победитель матча меняется. Счёт следующих матчей (${reset.length}) будет сброшен, их нужно будет ввести заново. Продолжить?`
          : null;
      }}
      onClose={onClose}
    />
  );
}

// ── Вкладки ─────────────────────────────────────────────────
function GroupsTab({ t, name, onOpen }: { t: Tournament; name: NameFn; onOpen: (id: string) => void }) {
  const st = allStandings(t);
  const groups = activeGroups(t);
  const q = new Set(t.playoffSize >= 2 ? qualifiers(t).map((r) => r.playerId) : []);
  const matches = Object.values(t.matches);
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <GroupTable
          key={g}
          group={g}
          order={t.groups[g] ?? []}
          rows={st[g]}
          matches={matches}
          bestOf={t.bestOf}
          name={name}
          qualified={new Set([...q].filter((id) => (t.groups[g] ?? []).includes(id)))}
          onOpen={onOpen}
        />
      ))}
      <p className="text-xs text-muted">
        Нажмите на клетку, чтобы открыть матч. Места: победы → разница сетов → разница геймов → выигранные геймы → порядок в
        списке группы.
        {t.playoffSize >= 2 && ` В плей-офф выходят ${t.playoffSize}: сначала первые места групп, затем лучшие из следующих.`}
      </p>
    </div>
  );
}

function MatchesTab({ t, name, onOpen }: { t: Tournament; name: NameFn; onOpen: (id: string) => void }) {
  const matches = sortedMatches(t);
  const groups = activeGroups(t);
  const played = matches.filter((m) => matchState(m.sets, t.bestOf).complete).length;
  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Сыграно {played} из {matches.length} · нажмите на матч, чтобы {t.status === 'groups' ? 'открыть или ввести счёт' : 'открыть'}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g} className="card px-2 py-1">
            <h3 className="font-display font-bold text-court-700 pt-3 pb-1 px-2">Группа {g}</h3>
            {matches
              .filter((m) => m.group === g)
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => onOpen(m.id)}
                  className="w-full text-left rounded-xl px-2 py-2 border-b border-line last:border-0 hover:bg-court-50 transition"
                >
                  <div className="flex justify-end mb-0.5">
                    <StatusPill sets={m.sets} bestOf={t.bestOf} />
                  </div>
                  <MatchLines p1={m.p1} p2={m.p2} name={name} sets={m.sets} bestOf={t.bestOf} reserveSets />
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayoffTab({ t, name, onOpen }: { t: Tournament; name: NameFn; onOpen: (id: string) => void }) {
  if (!t.playoff) {
    const preview = seedBracket(t);
    const b = preview && resolveBracket({ playoff: preview, bestOf: t.bestOf });
    return (
      <div>
        <Notice>
          Плей-офф начнётся после группового этапа. Ниже — сетка, какой она будет, если всё останется как сейчас.
        </Notice>
        {b ? <Bracket bracket={b} bestOf={t.bestOf} name={name} /> : <p className="text-muted text-sm">Недостаточно игроков для сетки.</p>}
      </div>
    );
  }
  const b = resolveBracket(t)!;
  return (
    <div>
      <p className="text-sm text-muted mb-3">Нажмите на матч, чтобы открыть его{t.status === 'playoff' ? ' или ввести счёт' : ''}.</p>
      <Bracket bracket={b} bestOf={t.bestOf} name={name} onOpen={onOpen} />
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
      <div className="card overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted bg-court-50">
              <th className="text-left font-semibold pl-4 pr-3 py-2 w-16">Место</th>
              <th className="text-left font-semibold py-2">Игрок</th>
              <th className="font-semibold px-2" title="Победы – поражения за весь турнир">Матчи</th>
              <th className="font-semibold px-2">Сеты</th>
              <th className="font-semibold px-2">Геймы</th>
              <th className="font-semibold px-2 pr-4">Очки</th>
            </tr>
          </thead>
          <tbody>
            {placings.map((pl) => {
              const r = playerRecord(t, pl.playerId);
              return (
                <tr key={pl.playerId} className="border-t border-line">
                  <td className="pl-4 py-2.5 font-bold">{done && pl.place <= 3 ? medal[pl.place - 1] : pl.place}</td>
                  <td className="py-2.5 font-semibold whitespace-nowrap">
                    <Link to={`/players/${pl.playerId}`} className="hover:underline">
                      {name(pl.playerId)}
                    </Link>
                  </td>
                  <td className="text-center px-2 whitespace-nowrap">
                    {r.wins} – {r.losses}
                  </td>
                  <td className="text-center px-2 whitespace-nowrap">
                    {r.setsFor} – {r.setsAgainst}
                  </td>
                  <td className="text-center px-2 whitespace-nowrap">
                    {r.gamesFor} – {r.gamesAgainst}
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

// ── Управление турниром ─────────────────────────────────────
function AdminPanel({ t }: { t: Tournament }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const hasPlayoff = t.playoffSize >= 2;
  const groupsDone = allGroupMatchesPlayed(t);
  const b = resolveBracket(t);
  const playoffDone = b ? bracketDone(b) : false;

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
              onClick={() =>
                run(async () => {
                  const p = seedBracket(t);
                  if (!p) throw new Error('Не удалось построить сетку');
                  await api.startPlayoff(t.id, p);
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
                  confirm('Отменить плей-офф? Весь счёт сетки будет удалён, групповой этап снова станет редактируемым.') &&
                  run(() => api.cancelPlayoff(t.id))
                }
              >
                Отменить плей-офф
              </button>
            </>
          )}
          {t.status === 'finished' && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => api.setStatus(t.id, t.playoff ? 'playoff' : 'groups'))}>
              Открыть для исправлений
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Настройки
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
      {!editing && t.status === 'groups' && !groupsDone && (
        <p className="text-xs text-muted mt-2">
          {hasPlayoff ? '«Начать плей-офф»' : '«Завершить турнир»'} станет доступно, когда будут доиграны все матчи групп.
        </p>
      )}
      {!editing && t.status === 'playoff' && !playoffDone && (
        <p className="text-xs text-muted mt-2">Завершить турнир можно после финала{b?.third ? ' и матча за 3 место' : ''}.</p>
      )}
      {err && <p className="text-sm text-clay-600 mt-2">{err}</p>}
    </div>
  );
}

function EditInfo({ t, onDone }: { t: Tournament; onDone: () => void }) {
  const [name, setName] = useState(t.name);
  const [date, setDate] = useState(t.date);
  const [season, setSeason] = useState(t.season);
  const [bestOf, setBestOf] = useState<BestOf>(t.bestOf);
  const [playoffSize, setPlayoffSize] = useState(t.playoffSize);
  const [thirdPlace, setThirdPlace] = useState(t.thirdPlace);
  const [busy, setBusy] = useState(false);
  const total = tournamentPlayerIds(t).length;
  const anyScore = Object.values(t.matches).some((m) => m.sets.length > 0);
  const canChangePlayoff = t.status === 'groups';

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await api.updateTournamentInfo(t.id, {
          name: name.trim(),
          date,
          season: season.trim(),
          ...(anyScore ? {} : { bestOf }),
          ...(canChangePlayoff ? { playoffSize, thirdPlace } : {}),
        });
        setBusy(false);
        onDone();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Название">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Дата">
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Сезон">
          <input className="field" value={season} onChange={(e) => setSeason(e.target.value)} required />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 items-end">
        <Field label="Формат матча">
          <select className="field" value={bestOf} disabled={anyScore} onChange={(e) => setBestOf(Number(e.target.value) as BestOf)}>
            <option value={1}>{BEST_OF_LABEL[1]}</option>
            <option value={3}>{BEST_OF_LABEL[3]}</option>
          </select>
        </Field>
        <Field label="В плей-офф выходят">
          <PlayoffSizeSelect value={playoffSize} max={total} disabled={!canChangePlayoff} onChange={setPlayoffSize} />
        </Field>
        <label className="flex items-center gap-2 text-sm pb-2.5">
          <input
            type="checkbox"
            checked={thirdPlace}
            disabled={!canChangePlayoff || playoffSize < 4}
            onChange={(e) => setThirdPlace(e.target.checked)}
          />
          Матч за 3 место
        </label>
      </div>
      {(anyScore || !canChangePlayoff) && (
        <p className="text-xs text-muted">
          {anyScore && 'Формат матча нельзя поменять, когда уже введён счёт. '}
          {!canChangePlayoff && 'Настройки плей-офф меняются только до его начала.'}
        </p>
      )}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

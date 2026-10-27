import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import * as api from '../api';
import { useData } from '../hooks/data';
import { GROUP_KEYS, type GroupKey } from '../types';

const MIN_PER_GROUP = 2;
const MAX_PER_GROUP = 6;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NewTournament() {
  const { players, tournaments } = useData();
  const navigate = useNavigate();
  const lastSeason = tournaments[0]?.season;

  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [season, setSeason] = useState(lastSeason ?? String(new Date().getFullYear()));
  const [groupCount, setGroupCount] = useState(2);
  const [groups, setGroups] = useState<Record<GroupKey, string[]>>({ A: [], B: [], C: [] });
  const [newNames, setNewNames] = useState<Record<GroupKey, string>>({ A: '', B: '', C: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const active = GROUP_KEYS.slice(0, groupCount);
  const chosen = new Set(active.flatMap((g) => groups[g]));
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '—';
  const available = players.filter((p) => !chosen.has(p.id));

  const add = (g: GroupKey, id: string) => setGroups((s) => ({ ...s, [g]: [...s[g], id] }));
  const remove = (g: GroupKey, id: string) => setGroups((s) => ({ ...s, [g]: s[g].filter((x) => x !== id) }));
  const move = (g: GroupKey, i: number, d: -1 | 1) =>
    setGroups((s) => {
      const list = [...s[g]];
      const j = i + d;
      if (j < 0 || j >= list.length) return s;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...s, [g]: list };
    });

  async function addNew(g: GroupKey) {
    const n = newNames[g].trim();
    if (!n) return;
    const existing = players.find((p) => p.name.toLowerCase() === n.toLowerCase());
    if (existing) {
      if (!chosen.has(existing.id)) add(g, existing.id);
    } else {
      const id = await api.addPlayer(n, null);
      add(g, id);
    }
    setNewNames((s) => ({ ...s, [g]: '' }));
  }

  /** Перемешать всех выбранных игроков и разложить по группам поровну (змейкой). */
  function shuffle() {
    const all = [...chosen];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const next: Record<GroupKey, string[]> = { A: [], B: [], C: [] };
    all.forEach((id, i) => next[active[i % active.length]].push(id));
    setGroups(next);
  }

  const problems: string[] = [];
  for (const g of active) {
    const n = groups[g].length;
    if (n < MIN_PER_GROUP) problems.push(`В группе ${g} нужно минимум ${MIN_PER_GROUP} игрока`);
    if (n > MAX_PER_GROUP) problems.push(`В группе ${g} не больше ${MAX_PER_GROUP} игроков`);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (problems.length) return;
    setBusy(true);
    setErr('');
    try {
      const g: Partial<Record<GroupKey, string[]>> = {};
      for (const k of active) g[k] = groups[k];
      const playerNames = Object.fromEntries([...chosen].map((id) => [id, nameOf(id)]));
      const id = await api.createTournament({ name: name || `Турнир ${date}`, date, season, groups: g, playerNames });
      navigate(`/t/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Link to="/" className="text-sm text-muted hover:text-ink">
        ← Все турниры
      </Link>
      <h1 className="font-display text-2xl font-bold mt-2 mb-5">Новый турнир</h1>

      <div className="card p-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr] mb-4">
        <label>
          <span className="label">Название</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Осенний кубок U10" />
        </label>
        <label>
          <span className="label">Дата</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span className="label">Сезон (для рейтинга)</span>
          <input className="field" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026" required />
        </label>
      </div>

      <div className="card p-4 mb-4">
        <span className="label">Количество групп</span>
        <div className="flex flex-wrap items-center gap-2">
          {[1, 2, 3].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setGroupCount(n)}
              className={`btn ${groupCount === n ? 'btn-primary' : 'btn-ghost'}`}
            >
              {n}
            </button>
          ))}
          <span className="text-xs text-muted ml-2">
            {groupCount === 1 && 'Круговой турнир без плей-офф'}
            {groupCount === 2 && 'В полуфинал выходят по двое из группы: A1–B2, B1–A2'}
            {groupCount === 3 && 'В полуфинал выходят победители групп и лучший второй'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold">Игроки по группам</h2>
        {active.length > 1 && chosen.size > 1 && (
          <button type="button" className="btn btn-ghost text-xs py-1.5" onClick={shuffle}>
            🎲 Перемешать
          </button>
        )}
      </div>

      <div className={`grid gap-4 mb-5 ${groupCount === 3 ? 'md:grid-cols-3' : groupCount === 2 ? 'md:grid-cols-2' : ''}`}>
        {active.map((g) => (
          <div key={g} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-court-700">Группа {g}</h3>
              <span className="text-xs text-muted">{groups[g].length} игр.</span>
            </div>
            <ol className="mb-3">
              {groups[g].map((id, i) => (
                <li key={id} className="flex items-center gap-2 py-1.5 border-b border-line text-sm">
                  <span className="text-muted w-4">{i + 1}</span>
                  <span className="flex-1 font-semibold truncate">{nameOf(id)}</span>
                  <button type="button" className="text-muted px-1 hover:text-ink" onClick={() => move(g, i, -1)} title="Выше">
                    ↑
                  </button>
                  <button type="button" className="text-muted px-1 hover:text-ink" onClick={() => move(g, i, 1)} title="Ниже">
                    ↓
                  </button>
                  <button type="button" className="text-clay-600 px-1" onClick={() => remove(g, id)} title="Убрать">
                    ×
                  </button>
                </li>
              ))}
              {groups[g].length === 0 && <li className="text-sm text-muted py-1.5">Пока пусто</li>}
            </ol>

            {available.length > 0 && (
              <select
                className="field mb-2"
                value=""
                onChange={(e) => e.target.value && add(g, e.target.value)}
                aria-label={`Добавить игрока в группу ${g}`}
              >
                <option value="">+ Выбрать из списка игроков</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.birthYear ? ` (${p.birthYear})` : ''}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <input
                className="field"
                placeholder="Новый игрок: имя"
                value={newNames[g]}
                onChange={(e) => setNewNames((s) => ({ ...s, [g]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNew(g);
                  }
                }}
              />
              <button type="button" className="btn btn-ghost" onClick={() => addNew(g)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted mb-4">
        Порядок в группе важен только при полном равенстве показателей (как в Excel): выше в списке — выше в таблице.
      </p>

      {problems.length > 0 && chosen.size > 0 && (
        <ul className="text-sm text-clay-600 mb-3 list-disc pl-5">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {err && <p className="text-sm text-clay-600 mb-3">{err}</p>}

      <button className="btn btn-primary w-full sm:w-auto" disabled={busy || problems.length > 0}>
        {busy ? 'Создаю…' : 'Создать турнир и расписание матчей'}
      </button>
    </form>
  );
}

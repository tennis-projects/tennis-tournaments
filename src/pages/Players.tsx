import { useState } from 'react';
import { Link } from 'react-router';
import * as api from '../api';
import { useData } from '../hooks/data';
import { tournamentPlayerIds } from '../lib/results';
import type { Player } from '../types';

export default function Players() {
  const { players, tournaments, isAdmin } = useData();
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const count = new Map<string, number>();
  for (const t of tournaments) for (const id of tournamentPlayerIds(t)) count.set(id, (count.get(id) ?? 0) + 1);

  const list = players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-5">Игроки</h1>

      {isAdmin && (
        <form
          className="card p-4 mb-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto] items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await api.addPlayer(name, year ? Number(year) : null);
            setName('');
            setYear('');
          }}
        >
          <label>
            <span className="label">Имя и фамилия</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Варя К." />
          </label>
          <label>
            <span className="label">Год рождения</span>
            <input className="field" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2016" />
          </label>
          <button className="btn btn-primary">Добавить</button>
        </form>
      )}

      <input className="field mb-3" placeholder="Поиск по имени" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card divide-y divide-line">
        {list.map((p) =>
          editId === p.id ? (
            <EditRow key={p.id} p={p} onDone={() => setEditId(null)} played={count.get(p.id) ?? 0} />
          ) : (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Link to={`/players/${p.id}`} className="flex-1 min-w-0 hover:underline">
                <span className="font-semibold">{p.name}</span>
                {p.birthYear ? <span className="text-muted text-sm"> · {p.birthYear}</span> : null}
              </Link>
              <span className="text-xs text-muted">{count.get(p.id) ?? 0} турн.</span>
              {isAdmin && (
                <button className="text-sm text-court-600 hover:underline" onClick={() => setEditId(p.id)}>
                  Изменить
                </button>
              )}
            </div>
          ),
        )}
        {list.length === 0 && <p className="px-4 py-6 text-center text-muted text-sm">Никого не найдено</p>}
      </div>
    </div>
  );
}

function EditRow({ p, onDone, played }: { p: Player; onDone: () => void; played: number }) {
  const [name, setName] = useState(p.name);
  const [year, setYear] = useState(p.birthYear ? String(p.birthYear) : '');
  return (
    <form
      className="px-4 py-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto_auto] items-center bg-court-50/60"
      onSubmit={async (e) => {
        e.preventDefault();
        await api.updatePlayer(p.id, { name, birthYear: year ? Number(year) : null });
        onDone();
      }}
    >
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className="field" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Год" />
      <button className="btn btn-primary">Сохранить</button>
      <button type="button" className="btn btn-ghost" onClick={onDone}>
        Отмена
      </button>
      <button
        type="button"
        className="btn btn-danger"
        onClick={async () => {
          const warn = played
            ? `«${p.name}» участвовал(а) в ${played} турн. Результаты останутся в истории под старым именем, но страница игрока пропадёт. Удалить?`
            : `Удалить «${p.name}»?`;
          if (confirm(warn)) {
            await api.deletePlayer(p.id);
            onDone();
          }
        }}
      >
        Удалить
      </button>
    </form>
  );
}

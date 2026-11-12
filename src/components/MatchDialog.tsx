import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { BestOf, SetScore } from '../types';
import { BEST_OF_LABEL, matchState, validateSets } from '../lib/score';

interface Props {
  title: string;
  subtitle?: string;
  p1: string | null;
  p2: string | null;
  name: (id: string | null) => string;
  sets: SetScore[];
  bestOf: BestOf;
  editable: boolean;
  /** почему счёт нельзя менять (показывается админу) */
  lockedReason?: string;
  onSave: (sets: SetScore[]) => Promise<void>;
  /** вернуть предупреждение перед сохранением (например, о сбросе следующих матчей) или null */
  confirmText?: (sets: SetScore[]) => string | null;
  onClose: () => void;
}

type Draft = { a: string; b: string }[];

const toDraft = (sets: SetScore[], n: number): Draft =>
  Array.from({ length: n }, (_, i) => ({ a: sets[i] ? String(sets[i].a) : '', b: sets[i] ? String(sets[i].b) : '' }));

/** Карточка матча: статус, счёт по сетам, для админа — ввод счёта. */
export default function MatchDialog(props: Props) {
  const { title, subtitle, p1, p2, name, sets, bestOf, editable, lockedReason, onSave, confirmText, onClose } = props;
  const [draft, setDraft] = useState<Draft>(() => toDraft(sets, bestOf));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = Boolean(p1 && p2);
  const canEdit = editable && ready;

  // если счёт поменял второй админ — подтягиваем
  const key = JSON.stringify(sets);
  useEffect(() => setDraft(toDraft(sets, bestOf)), [key, bestOf]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const st = matchState(sets, bestOf);
  const status = !ready ? 'Ждёт соперника' : st.complete ? 'Окончен' : st.started ? 'Идёт' : 'Не сыгран';
  // для матча в 1 сет крупно показываем геймы, для 3 сетов — счёт по сетам
  const big = bestOf === 1 ? [sets[0]?.a, sets[0]?.b] : st.started ? [st.setsA, st.setsB] : [undefined, undefined];

  function parse(): SetScore[] | string {
    const out: SetScore[] = [];
    let gap = false;
    for (let i = 0; i < draft.length; i++) {
      const { a, b } = draft[i];
      if (a === '' && b === '') {
        gap = true;
        continue;
      }
      if (a === '' || b === '') return `Сет ${i + 1}: введите оба числа`;
      if (gap) return `Сначала заполните сет ${i}`;
      out.push({ a: Number(a), b: Number(b) });
    }
    return validateSets(out, bestOf) ?? out;
  }

  async function save(next: SetScore[]) {
    const warn = confirmText?.(next);
    if (warn && !confirm(warn)) return;
    setBusy(true);
    setErr('');
    try {
      await onSave(next);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не сохранилось');
    } finally {
      setBusy(false);
    }
  }

  const sideCls = (side: 1 | 2) =>
    `font-bold leading-tight ${st.winner === side ? 'text-court-900' : st.winner ? 'text-muted' : 'text-ink'}`;

  const Avatar = ({ id }: { id: string | null }) => (
    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-court-100 text-court-700 grid place-items-center font-display font-bold text-xl mx-auto">
      {id ? name(id).slice(0, 1).toUpperCase() : '?'}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-end sm:place-items-center p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</div>
            {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
          </div>
          <button className="text-muted hover:text-ink text-2xl leading-none -mt-1" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="text-center text-sm font-semibold mb-3">{status}</div>

        {/* игроки и крупный счёт */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
          <div className="text-center min-w-0">
            <Avatar id={p1} />
            <div className={`${sideCls(1)} mt-2 truncate`}>
              {p1 ? <Link to={`/players/${p1}`} className="hover:underline">{name(p1)}</Link> : '—'}
            </div>
          </div>
          <div className="font-display font-bold text-4xl sm:text-5xl tabular-nums whitespace-nowrap">
            <span className={st.winner === 2 ? 'text-muted' : ''}>{big[0] ?? '–'}</span>
            <span className="text-muted mx-2">:</span>
            <span className={st.winner === 1 ? 'text-muted' : ''}>{big[1] ?? '–'}</span>
          </div>
          <div className="text-center min-w-0">
            <Avatar id={p2} />
            <div className={`${sideCls(2)} mt-2 truncate`}>
              {p2 ? <Link to={`/players/${p2}`} className="hover:underline">{name(p2)}</Link> : '—'}
            </div>
          </div>
        </div>

        {/* сеты */}
        <div className="flex justify-center">
          <table className="tabular-nums">
            <tbody>
              {([1, 2] as const).map((side) => (
                <tr key={side}>
                  <td className="pr-3 text-xs text-muted max-w-24 truncate">{name(side === 1 ? p1 : p2)}</td>
                  {draft.map((d, i) => {
                    const v = side === 1 ? d.a : d.b;
                    const saved = sets[i];
                    const mine = saved ? (side === 1 ? saved.a : saved.b) : null;
                    const theirs = saved ? (side === 1 ? saved.b : saved.a) : null;
                    return (
                      <td key={i} className="p-1">
                        {canEdit ? (
                          <input
                            className="w-12 h-11 text-center rounded-lg border border-line bg-paper font-display font-bold text-lg focus:outline-2 focus:outline-court-500 focus:bg-white"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={v}
                            aria-label={`Сет ${i + 1}, ${name(side === 1 ? p1 : p2)}`}
                            onChange={(e) => {
                              const next = draft.map((x) => ({ ...x }));
                              next[i][side === 1 ? 'a' : 'b'] = e.target.value;
                              setDraft(next);
                              setErr('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const r = parse();
                                if (typeof r === 'string') setErr(r);
                                else save(r);
                              }
                            }}
                          />
                        ) : (
                          <div
                            className={`w-11 h-10 grid place-items-center rounded-lg bg-paper text-base ${
                              mine == null ? 'text-muted' : mine > (theirs ?? 0) ? 'font-bold' : 'text-muted'
                            }`}
                          >
                            {mine ?? '-'}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td />
                {draft.map((_, i) => (
                  <td key={i} className="text-center text-xs text-muted pt-1">
                    {i + 1}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-muted mt-2">Формат: {BEST_OF_LABEL[bestOf]}</p>

        {canEdit && (
          <div className="mt-5">
            {err && <p className="text-sm text-clay-600 mb-2 text-center">{err}</p>}
            <div className="flex gap-2">
              <button
                className="btn btn-primary flex-1"
                disabled={busy}
                onClick={() => {
                  const r = parse();
                  if (typeof r === 'string') setErr(r);
                  else save(r);
                }}
              >
                {busy ? 'Сохраняю…' : 'Сохранить счёт'}
              </button>
              {sets.length > 0 && (
                <button className="btn btn-danger" disabled={busy} onClick={() => confirm('Очистить счёт матча?') && save([])}>
                  Очистить
                </button>
              )}
            </div>
            <p className="text-xs text-muted mt-2 text-center">
              Можно сохранять по ходу матча — родители увидят счёт сразу. Незаконченный матч в таблицу не идёт.
            </p>
          </div>
        )}
        {editable && !ready && <p className="text-xs text-muted mt-4 text-center">Счёт можно ввести, когда определятся оба соперника.</p>}
        {!editable && lockedReason && <p className="text-xs text-muted mt-4 text-center">{lockedReason}</p>}
      </div>
    </div>
  );
}

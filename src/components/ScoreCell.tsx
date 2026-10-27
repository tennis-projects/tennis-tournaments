import { useEffect, useState } from 'react';
import type { Score } from '../types';

interface Props {
  score: Score;
  editable: boolean;
  disabled?: boolean;
  onSave: (g1: number | null, g2: number | null) => Promise<void>;
}

const toStr = (v: number | null) => (v == null ? '' : String(v));

/**
 * Счёт матча. Для тренера — два поля, сохраняются по Enter, по кнопке ✓ или при уходе с поля.
 * Оба поля пустые = матч не сыгран. Ничья не допускается.
 */
export default function ScoreCell({ score, editable, disabled, onSave }: Props) {
  const [a, setA] = useState(toStr(score.g1));
  const [b, setB] = useState(toStr(score.g2));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  // внешние изменения (второй админ ввёл счёт) подтягиваем, если поле не редактируется
  useEffect(() => {
    setA(toStr(score.g1));
    setB(toStr(score.g2));
  }, [score.g1, score.g2]);

  if (!editable) {
    if (score.g1 == null || score.g2 == null) return <span className="text-muted text-sm">—</span>;
    return (
      <span className="font-display font-bold tabular-nums text-base whitespace-nowrap">
        {score.g1}<span className="text-muted mx-1">:</span>{score.g2}
      </span>
    );
  }

  const dirty = a !== toStr(score.g1) || b !== toStr(score.g2);

  async function save() {
    if (!dirty) return;
    const empty = a === '' && b === '';
    const n1 = a === '' ? null : Number(a);
    const n2 = b === '' ? null : Number(b);
    if (!empty) {
      if (n1 == null || n2 == null) return; // ждём второе число
      if (!Number.isInteger(n1) || !Number.isInteger(n2) || n1 < 0 || n2 < 0 || n1 > 99 || n2 > 99) {
        setState('error');
        setMsg('Только целые числа 0–99');
        return;
      }
      if (n1 === n2) {
        setState('error');
        setMsg('Ничья невозможна');
        return;
      }
    }
    setState('saving');
    try {
      await onSave(empty ? null : n1, empty ? null : n2);
      setState('saved');
      setMsg('');
      setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 1200);
    } catch (e) {
      setState('error');
      setMsg(e instanceof Error ? e.message : 'Не сохранилось');
    }
  }

  const input =
    'w-11 h-10 text-center rounded-lg border border-line bg-white font-display font-bold tabular-nums focus:outline-2 focus:outline-court-500 disabled:bg-paper';

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className="flex items-center gap-1"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) save();
        }}
      >
        <input
          className={input}
          type="number"
          inputMode="numeric"
          min={0}
          value={a}
          disabled={disabled}
          aria-label="Геймы игрока 1"
          onChange={(e) => {
            setA(e.target.value);
            setState('idle');
          }}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <span className="text-muted">:</span>
        <input
          className={input}
          type="number"
          inputMode="numeric"
          min={0}
          value={b}
          disabled={disabled}
          aria-label="Геймы игрока 2"
          onChange={(e) => {
            setB(e.target.value);
            setState('idle');
          }}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <span className="w-5 text-center text-sm">
          {state === 'saving' && <span className="text-muted">…</span>}
          {state === 'saved' && <span className="text-court-500">✓</span>}
          {state === 'error' && <span className="text-clay-600">!</span>}
          {state === 'idle' && dirty && a === '' && b === '' && (
            <button className="text-clay-600" title="Очистить счёт" onClick={save}>
              ×
            </button>
          )}
        </span>
      </div>
      {state === 'error' && <span className="text-xs text-clay-600">{msg}</span>}
    </div>
  );
}

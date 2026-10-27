import type { Score } from '../types';
import { winnerSide } from '../lib/standings';
import ScoreCell from './ScoreCell';

interface Props {
  label?: string;
  p1: string | null;
  p2: string | null;
  name: (id: string | null) => string;
  score: Score;
  editable: boolean;
  onSave: (g1: number | null, g2: number | null) => Promise<void>;
}

export default function MatchRow({ label, p1, p2, name, score, editable, onSave }: Props) {
  const w = winnerSide(score);
  const ready = Boolean(p1 && p2);
  const nameCls = (side: 1 | 2) =>
    `truncate ${w === side ? 'font-bold text-court-900' : w ? 'text-muted' : ''}`;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
      {label && <span className="text-[11px] font-semibold text-muted w-10 shrink-0">{label}</span>}
      <div className="flex-1 min-w-0 text-sm leading-tight">
        <div className={nameCls(1)}>
          {w === 1 && <span className="inline-block w-2 h-2 rounded-full bg-ball border border-court-700 mr-1.5 align-middle" />}
          {ready || p1 ? name(p1) : <span className="text-muted">ждёт соперника</span>}
        </div>
        <div className={nameCls(2)}>
          {w === 2 && <span className="inline-block w-2 h-2 rounded-full bg-ball border border-court-700 mr-1.5 align-middle" />}
          {ready || p2 ? name(p2) : <span className="text-muted">ждёт соперника</span>}
        </div>
      </div>
      <ScoreCell score={score} editable={editable && ready} onSave={onSave} />
    </div>
  );
}

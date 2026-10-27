import type { TournamentStatus } from '../types';

const MAP: Record<TournamentStatus, [string, string]> = {
  groups: ['Групповой этап', 'bg-court-100 text-court-700'],
  playoff: ['Плей-офф', 'bg-ball text-court-900'],
  finished: ['Завершён', 'bg-paper text-muted border border-line'],
};

export default function StatusBadge({ status }: { status: TournamentStatus }) {
  const [text, cls] = MAP[status];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{text}</span>;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

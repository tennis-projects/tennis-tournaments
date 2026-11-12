import type { BestOf } from '../types';
import { roundName, type BracketMatch, type ResolvedBracket } from '../lib/playoff';
import MatchLines from './MatchLines';

interface Props {
  bracket: ResolvedBracket;
  bestOf: BestOf;
  name: (id: string | null) => string;
  onOpen?: (matchId: string) => void;
}

const GAP = 16; // половина расстояния между кругами, px

/** Сетка плей-офф: круги слева направо, линии соединяют пары матчей. */
export default function Bracket({ bracket, bestOf, name, onOpen }: Props) {
  const R = bracket.rounds.length;
  const firstCount = bracket.rounds[0].length;
  const unit = 84; // высота одной ячейки первого круга
  const height = firstCount * unit;

  const box = (m: BracketMatch) => {
    const empty = !m.p1 && !m.p2;
    const isBye = m.bye1 || m.bye2;
    const clickable = Boolean(onOpen) && !isBye && !empty;
    const Tag = clickable ? 'button' : 'div';
    return (
      <Tag
        onClick={clickable ? () => onOpen!(m.id) : undefined}
        className={`w-56 rounded-xl border bg-white px-2.5 py-1.5 text-left ${
          m.round === R && !m.isThird ? 'border-court-500 border-2' : 'border-line'
        } ${clickable ? 'hover:border-court-500 hover:shadow-sm transition cursor-pointer' : ''} ${isBye ? 'opacity-70' : ''}`}
      >
        <MatchLines p1={m.p1} p2={m.p2} bye1={m.bye1} bye2={m.bye2} name={name} sets={m.sets} bestOf={bestOf} reserveSets={!isBye} compact />
      </Tag>
    );
  };

  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-2">
      <div className="flex" style={{ gap: GAP * 2 }}>
        {bracket.rounds.map((round, r) => (
          <div key={r} className="shrink-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2 h-4">
              {round[0].round === R ? '🏆 ' : ''}
              {roundName(r + 1, R)}
            </div>
            <div className="flex flex-col" style={{ height }}>
              {round.map((m, i) => (
                <div key={m.id} className="flex-1 relative flex items-center">
                  {r > 0 && (
                    <div className="absolute border-t border-court-200" style={{ left: -GAP, width: GAP, top: '50%' }} />
                  )}
                  {r < R - 1 && (
                    <div
                      className={`absolute border-r border-court-200 ${i % 2 === 0 ? 'border-t' : 'border-b'}`}
                      style={{ right: -GAP, width: GAP, top: i % 2 === 0 ? '50%' : 0, height: '50%' }}
                    />
                  )}
                  {box(m)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {bracket.third && (
        <div className="mt-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Матч за 3 место</div>
          {box(bracket.third)}
        </div>
      )}
    </div>
  );
}

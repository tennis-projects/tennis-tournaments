/** Выбор, сколько игроков выходит в плей-офф. Не степень двойки → сетка с BYE. */
export default function PlayoffSizeSelect({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  const options = [0, ...Array.from({ length: Math.max(0, Math.min(16, max) - 1) }, (_, i) => i + 2)];
  if (!options.includes(value)) options.push(value);
  return (
    <select className="field" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}>
      {options.map((n) => (
        <option key={n} value={n}>
          {n === 0 ? 'никто (без плей-офф)' : `${n} игрок${n < 5 ? 'а' : 'ов'}${[2, 4, 8, 16].includes(n) ? '' : ` (сетка на ${bracketLabel(n)}, есть BYE)`}`}
        </option>
      ))}
    </select>
  );
}

function bracketLabel(n: number) {
  let s = 2;
  while (s < n) s *= 2;
  return s;
}


// A small headerExtra dropdown for widgets with a time-range/interval
// control (DAU/WAU/MAU's day count, Growth Indicator's week/month interval,
// ...). Deliberately generic over the option value so it isn't tied to days.
export type RangeOption<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = {
  value: T;
  options: RangeOption<T>[];
  onChange: (value: T) => void;
};

export default function RangeSelect<T extends string | number>({
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <select
      className="select"
      style={{ height: 28, fontSize: 10.5 }}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const match = options.find((o) => String(o.value) === raw);
        if (match) onChange(match.value);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

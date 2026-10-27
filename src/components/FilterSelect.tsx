type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  // An option marked disabled stays listed but cannot be picked.
  options: [value: string, label: string, disabled?: boolean][];
  // Accessible name, for selects without a visible label.
  label?: string;
  // Light up while set to anything but the first option.
  highlight?: boolean;
};

// A pill-shaped native select; native arrows sit flush against the rounded edge on desktop, so it draws its own.
export default function FilterSelect({ value, onChange, options, label, highlight = false }: FilterSelectProps) {
  const active = highlight && value !== options[0]?.[0];
  return (
    <span className="relative flex flex-none items-center">
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 max-w-[11rem] appearance-none truncate rounded-full border-0 pl-3 pr-8 text-xs ring-1 outline-none focus:ring-amber-500/50 ${
          active
            ? "bg-zinc-100 font-medium text-zinc-900 ring-zinc-100"
            : "bg-zinc-900 text-zinc-200 ring-zinc-800"
        }`}
      >
        {options.map(([optionValue, optionLabel, disabled]) => (
          <option key={optionValue} value={optionValue} disabled={disabled}>
            {optionLabel}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
        className={`pointer-events-none absolute right-2.5 h-3.5 w-3.5 ${
          active ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

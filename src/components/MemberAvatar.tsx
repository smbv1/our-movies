export type Member = { id: string; display_name: string };

// One color per member in list order, so each person is recognisable at a glance.
const COLORS = [
  "bg-amber-400 text-amber-950",
  "bg-rose-400 text-rose-950",
  "bg-sky-400 text-sky-950",
  "bg-emerald-400 text-emerald-950",
] as const;

const SIZES = {
  xs: "h-4 w-4 text-[9px]",
  sm: "h-6 w-6 text-[11px]",
  md: "h-9 w-9 text-sm",
} as const;

type MemberAvatarProps = {
  name: string;
  // Position of the member in the list; picks the color.
  index: number;
  size?: keyof typeof SIZES;
  className?: string;
};

export default function MemberAvatar({
  name,
  index,
  size = "sm",
  className = "",
}: MemberAvatarProps) {
  const color = index < 0 ? "bg-zinc-600 text-zinc-100" : COLORS[index % COLORS.length];
  return (
    <span
      aria-hidden
      className={`inline-flex flex-none items-center justify-center rounded-full font-bold uppercase leading-none ${color} ${SIZES[size]} ${className}`}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

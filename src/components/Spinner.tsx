type SpinnerProps = {
  size?: "sm" | "md";
  label?: string;
  className?: string;
};

const sizeClass = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
} as const;

export default function Spinner({ size = "sm", label, className = "" }: SpinnerProps) {
  return (
    <>
      <span
        aria-hidden
        className={`inline-block shrink-0 animate-spin rounded-full border-current border-t-transparent ${sizeClass[size]} ${className}`}
      />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}

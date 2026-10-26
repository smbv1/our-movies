type LogoProps = { className?: string };

// Heart with a play button: "our movies" for two. Same artwork as app/icon.svg.
export default function Logo({ className = "h-9 w-9" }: LogoProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f43f5e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-bg)" />
      <path
        d="M32 50 C14 38 10 30 10 23 C10 16 15.5 11 22 11 C26.5 11 30 13.5 32 17 C34 13.5 37.5 11 42 11 C48.5 11 54 16 54 23 C54 30 50 38 32 50 Z"
        fill="#fff"
      />
      <path d="M27 21 L41 29.5 L27 38 Z" fill="#e11d48" />
    </svg>
  );
}

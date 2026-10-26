const PLACEHOLDER_COUNT = 10;

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Загрузка списка"
      className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 sm:px-6"
    >
      <header className="flex items-center justify-between gap-3 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-zinc-800" />
          <div className="h-6 w-36 animate-pulse rounded-md bg-zinc-800" />
        </div>
        <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-800/70" />
      </header>

      <div className="-mx-4 flex flex-col gap-2 border-b border-zinc-800/60 px-4 py-3 sm:-mx-6 sm:flex-row sm:px-6">
        <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-900 sm:flex-1" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-900 sm:w-64" />
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 pt-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
          <li key={i} className="flex animate-pulse flex-col gap-2">
            <div className="aspect-[2/3] w-full rounded-xl bg-zinc-900" />
            <div className="h-3.5 w-3/4 rounded bg-zinc-800" />
            <div className="h-3 w-1/3 rounded bg-zinc-800/70" />
          </li>
        ))}
      </ul>
    </div>
  );
}

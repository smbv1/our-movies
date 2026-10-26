const PLACEHOLDER_COUNT = 8;

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Загрузка списка"
      className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-800" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-zinc-800/70" />
        </div>
        <div className="h-10 w-24 animate-pulse rounded-lg bg-zinc-800/70" />
      </header>

      <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-900" />

      <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-900" />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
          <li key={i}>
            <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 animate-pulse">
              <div className="aspect-[2/3] w-full bg-zinc-800" />
              <div className="flex flex-col gap-2 p-3">
                <div className="h-3.5 w-3/4 rounded bg-zinc-800" />
                <div className="h-3 w-1/3 rounded bg-zinc-800/70" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

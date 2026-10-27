export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Загрузка статистики"
      className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 pb-24 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6"
    >
      <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
      <div className="h-8 w-56 animate-pulse rounded-md bg-zinc-800" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-900" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-2xl bg-zinc-900" />
      <div className="h-64 animate-pulse rounded-2xl bg-zinc-900" />
    </div>
  );
}

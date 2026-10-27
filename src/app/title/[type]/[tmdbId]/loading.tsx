export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Загрузка фильма"
      className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 sm:px-6"
    >
      <div className="h-5 w-24 animate-pulse rounded-md bg-zinc-800/70" />
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="aspect-[2/3] w-40 shrink-0 animate-pulse self-center rounded-xl bg-zinc-800 sm:w-56 sm:self-start" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="h-8 w-2/3 animate-pulse rounded-md bg-zinc-800" />
          <div className="h-4 w-1/2 animate-pulse rounded-md bg-zinc-800/70" />
          <div className="h-4 w-full animate-pulse rounded-md bg-zinc-800/70" />
          <div className="h-4 w-full animate-pulse rounded-md bg-zinc-800/70" />
          <div className="h-4 w-3/4 animate-pulse rounded-md bg-zinc-800/70" />
        </div>
      </div>
      <div className="aspect-video w-full animate-pulse rounded-xl bg-zinc-900" />
    </div>
  );
}

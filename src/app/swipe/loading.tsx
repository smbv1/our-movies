export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Загрузка карточек"
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
      <div className="h-8 w-32 animate-pulse rounded-md bg-zinc-800" />
      <div className="h-10 animate-pulse rounded-xl bg-zinc-900" />
      <div className="aspect-[2/3] w-full animate-pulse rounded-3xl bg-zinc-900" />
    </div>
  );
}

import Spinner from "@/components/Spinner";

export default function Loading() {
  return (
    <main
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-sm text-zinc-400"
    >
      <Spinner size="md" />
      <span>Загрузка…</span>
    </main>
  );
}

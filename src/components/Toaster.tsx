"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastInput = {
  message: string;
  tone?: "default" | "error";
  // Optional button next to the message, such as "Отменить".
  action?: { label: string; onClick: () => void };
  // Called once when the toast goes away without its action being pressed.
  onExpire?: () => void;
};

type Toast = ToastInput & { id: number };

type ToastApi = { show: (toast: ToastInput) => void };

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_MS = 5000;
// Only the newest few stay on screen; older ones expire right away.
const MAX_TOASTS = 3;

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster>");
  return ctx;
}

export default function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // Mirrors `toasts` so callbacks see the current list without re-subscribing.
  const toastsRef = useRef<Toast[]>([]);

  // Removes a toast; `expired` runs its onExpire (the action was not used).
  const remove = useCallback((id: number, expired: boolean) => {
    const toast = toastsRef.current.find((t) => t.id === id);
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    toastsRef.current = toastsRef.current.filter((t) => t.id !== id);
    setToasts(toastsRef.current);
    if (expired) toast?.onExpire?.();
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const toast = { ...input, id };
      const overflow = toastsRef.current.slice(
        0,
        Math.max(0, toastsRef.current.length - (MAX_TOASTS - 1)),
      );
      overflow.forEach((t) => remove(t.id, true));
      toastsRef.current = [...toastsRef.current, toast];
      setToasts(toastsRef.current);
      timers.current.set(
        id,
        setTimeout(() => remove(id, true), TOAST_MS),
      );
    },
    [remove],
  );

  // Pending work (like a delayed delete) still runs if the page goes away.
  useEffect(() => {
    function flush() {
      toastsRef.current.forEach((t) => remove(t.id, true));
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [remove]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`animate-toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl shadow-black/50 backdrop-blur ${
              t.tone === "error"
                ? "border-red-900/60 bg-red-950/90 text-red-100"
                : "border-zinc-700/60 bg-zinc-900/95 text-zinc-100"
            }`}
          >
            <p className="min-w-0 flex-1">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  remove(t.id, false);
                }}
                className="flex-none rounded-lg px-2 py-1 font-semibold text-amber-400 transition hover:bg-zinc-800"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(t.id, true)}
              aria-label="Закрыть уведомление"
              className="flex-none rounded-lg p-1 text-zinc-500 transition hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

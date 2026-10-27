"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { setServices } from "@/app/movies/actions";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import { tmdbImage, type StoredProvider } from "@/lib/types";

type ServicesButtonProps = {
  // Every streaming service that some title in the list is on, most titles first.
  providers: StoredProvider[];
  // Provider ids the couple has marked as theirs.
  services: number[];
  className?: string;
};

// Opens a picker of the streaming services the couple pays for; the list can then
// show which titles are on them.
export default function ServicesButton({
  providers,
  services,
  className = "",
}: ServicesButtonProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set(services));
  const [saving, startSaving] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function show() {
    setPicked(new Set(services));
    setOpen(true);
  }

  function toggle(id: number) {
    setPicked((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    startSaving(async () => {
      const result = await setServices([...picked]);
      if (result.error) {
        toast.show({ message: result.error, tone: "error" });
        return;
      }
      setOpen(false);
      toast.show({ message: "Сервисы сохранены" });
    });
  }

  return (
    <>
      <button type="button" onClick={show} className={className}>
        <span aria-hidden>📺</span>
        {services.length > 0
          ? `Наши сервисы · ${services.length}`
          : "Наши сервисы"}
      </button>

      {/* Portalled out of the swipeable filter row, which would clip and scroll it. */}
      {open &&
        createPortal(
          <div
            className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="services-title"
              onClick={(e) => e.stopPropagation()}
              className="animate-pop-in flex max-h-[85vh] w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2
                  id="services-title"
                  className="text-lg font-bold text-zinc-50"
                >
                  Наши сервисы
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-zinc-400">
                Отметьте, где у вас есть подписка. На карточках эти сервисы
                подсветятся, а в фильтре «Где смотреть» появится «На наших
                сервисах».
              </p>

              {providers.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Пока ни для одного фильма в списке не нашлось сервисов. Они
                  появятся здесь, когда TMDB что-то узнает.
                </p>
              ) : (
                <ul className="-mx-1 flex flex-col gap-1 overflow-y-auto px-1">
                  {providers.map((p) => {
                    const on = picked.has(p.id);
                    return (
                      <li key={p.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition ${
                            on ? "bg-amber-400/10" : "hover:bg-zinc-800"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(p.id)}
                            className="h-4 w-4 accent-amber-400"
                          />
                          <ProviderLogo provider={p} size="md" />
                          <span className="text-sm text-zinc-200">
                            {p.name}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-100"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {saving && <Spinner />}
                  Сохранить
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

const LOGO_SIZES = { sm: "h-5 w-5 rounded", md: "h-7 w-7 rounded-md" } as const;

// A service's square logo from TMDB, or its first letter when there is none.
export function ProviderLogo({
  provider,
  size = "sm",
  className = "",
}: {
  provider: StoredProvider;
  size?: keyof typeof LOGO_SIZES;
  className?: string;
}) {
  return provider.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tmdbImage(provider.logo, "w92")}
      loading="lazy"
      alt=""
      className={`flex-none ${LOGO_SIZES[size]} ${className}`}
    />
  ) : (
    <span
      aria-hidden
      className={`flex flex-none items-center justify-center bg-zinc-700 text-[10px] font-bold text-zinc-200 ${LOGO_SIZES[size]} ${className}`}
    >
      {provider.name.charAt(0)}
    </span>
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const DISMISSED_KEY = "install-app-dismissed";

// Chrome's install event; not in TypeScript's DOM types.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// "app": already opened from the home screen; "ios": Safari can only install by hand.
type Platform = "app" | "ios" | "other";

function readPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "app";
  // iPadOS reports itself as a Mac, but a Mac has no touch screen.
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

// A banner offering to put the site on the phone's home screen, until it is installed or closed.
export default function InstallApp() {
  // The server can't know the device, so it renders nothing and the browser fills in.
  const platform = useSyncExternalStore<Platform>(noSubscribe, readPlatform, () => "app");
  const dismissedBefore = useSyncExternalStore(noSubscribe, readDismissed, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    function onPrompt(e: Event) {
      // Keep Chrome's own mini-bar away; the banner's button shows the dialog instead.
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    }
    function onInstalled() {
      setInstallEvent(null);
      setDismissed(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Not remembered; it comes back next visit.
    }
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // The event works only once; Chrome fires a new one if it can ask again.
    setInstallEvent(null);
    if (outcome === "accepted") setDismissed(true);
  }

  const canInstall = installEvent !== null || platform === "ios";
  if (platform === "app" || dismissedBefore || dismissed || !canInstall) return null;

  return (
    <div className="animate-fade-in flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-zinc-800 text-xl"
        >
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-50">Поставьте на главный экран</p>
          <p className="text-xs text-zinc-400">
            Будет открываться как приложение, без адресной строки
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Скрыть"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          ✕
        </button>
      </div>

      {installEvent ? (
        <button
          type="button"
          onClick={install}
          className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
        >
          Установить
        </button>
      ) : showHowTo ? (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-zinc-300">
          <li>
            Нажмите «Поделиться»{" "}
            <ShareIcon />{" "}
            внизу Safari (на iPad вверху).
          </li>
          <li>Прокрутите и выберите «На экран „Домой“».</li>
          <li>Нажмите «Добавить».</li>
        </ol>
      ) : (
        <button
          type="button"
          onClick={() => setShowHowTo(true)}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
        >
          Как установить на iPhone
        </button>
      )}
    </div>
  );
}

// Safari's share icon, so the step points at the right button.
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="значок «Поделиться»"
      className="inline h-4 w-4 -translate-y-0.5 text-sky-400"
    >
      <path d="M10 12.5V2.5M6.5 6 10 2.5 13.5 6" />
      <path d="M6.5 9H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1.5" />
    </svg>
  );
}

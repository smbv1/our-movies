"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setNote } from "@/app/movies/actions";
import MemberAvatar from "@/components/MemberAvatar";
import type { RatedMember } from "@/components/Ratings";
import { MAX_NOTE_LENGTH } from "@/lib/types";

type MovieNotesProps = {
  movieId: string;
  // Me first, like the scores.
  members: RatedMember[];
  meId: string;
  notes: Record<string, string>;
};

// «Заметки» on a title's page: each member's note, readable by both, and mine editable.
export default function MovieNotes({ movieId, members, meId, notes }: MovieNotesProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(notes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const mine = shown[meId] ?? "";

  function startEditing() {
    setDraft(mine);
    setError(null);
    setEditing(true);
  }

  function save(body: string) {
    const text = body.trim();
    const next = { ...shown };
    if (text) next[meId] = text;
    else delete next[meId];
    setError(null);
    setEditing(false);
    startTransition(async () => {
      setShown(next);
      const result = await setNote(movieId, text);
      if (result.error) {
        setError(result.error);
        setDraft(text);
        setEditing(true);
      }
    });
  }

  return (
    <section className="flex max-w-md flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <h2 className="text-sm font-semibold text-zinc-100">Заметки</h2>

      <ul className="flex flex-col gap-2.5">
        {members.map((m) => {
          const isMe = m.id === meId;
          const text = shown[m.id];
          if (isMe && editing) return null;
          if (!isMe && !text) return null;
          return (
            <li key={m.id} className="flex items-start gap-2">
              <MemberAvatar name={m.display_name} index={m.index} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">{isMe ? "Моя заметка" : m.display_name}</p>
                {text ? (
                  <p className="whitespace-pre-line break-words text-sm text-zinc-200">{text}</p>
                ) : (
                  <p className="text-sm text-zinc-600">Пока пусто</p>
                )}
              </div>
              {isMe && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="flex-none rounded-lg px-2 py-1 text-xs font-medium text-amber-400 transition hover:bg-amber-400/10"
                >
                  {text ? "Изменить" : "Написать"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {editing && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(draft);
          }}
        >
          <label htmlFor="my-note" className="text-xs text-zinc-500">
            Моя заметка: что угодно, например «смотреть с попкорном» или «посоветовала Аня»
          </label>
          <textarea
            id="my-note"
            autoFocus
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(draft);
            }}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
            placeholder="Напиши заметку"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Отмена
            </button>
            {mine && (
              <button
                type="button"
                onClick={() => save("")}
                className="rounded-lg px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-950/40"
              >
                Удалить
              </button>
            )}
            <span className="ml-auto text-[11px] tabular-nums text-zinc-600">
              {draft.length}/{MAX_NOTE_LENGTH}
            </span>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}

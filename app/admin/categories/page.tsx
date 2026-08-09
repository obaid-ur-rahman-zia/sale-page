"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { normaliseImageUrl } from "@/lib/category-input";

type AdminCategory = {
  id: number;
  number: number;
  name: string;
  imageUrl: string;
  isActive: boolean;
  salesCount: number;
};

type DraftCategory = {
  number: string;
  name: string;
  imageUrl: string;
};

const emptyDraft: DraftCategory = { number: "", name: "", imageUrl: "" };

function ImagePreview({ url, alt }: { url: string; alt: string }) {
  const safeUrl = normaliseImageUrl(url);

  if (!safeUrl) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">
        No image
      </div>
    );
  }

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <Image src={safeUrl} alt={alt} fill sizes="64px" className="object-cover" unoptimized />
    </div>
  );
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [draft, setDraft] = useState<DraftCategory>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DraftCategory>(emptyDraft);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/categories?includeInactive=1", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load categories.");
      }
      const data = (await response.json()) as { categories: AdminCategory[] };
      setCategories(data.categories ?? []);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to load categories.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const nextNumber = useMemo(
    () => categories.reduce((highest, category) => Math.max(highest, category.number), 0) + 1,
    [categories],
  );

  async function readError(response: Response, fallback: string) {
    try {
      const data = (await response.json()) as { message?: string };
      return data.message ?? fallback;
    } catch {
      return fallback;
    }
  }

  async function createCategory() {
    if (draft.name.trim() === "" || normaliseImageUrl(draft.imageUrl) === null) {
      setFeedback({
        type: "error",
        text: "Enter a name and an image URL (https://... or a /path from the public folder).",
      });
      return;
    }

    try {
      setCreating(true);
      setFeedback(null);
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          imageUrl: draft.imageUrl,
          number: draft.number.trim() === "" ? undefined : Number(draft.number),
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to add category."));
      }

      setDraft(emptyDraft);
      setFeedback({ type: "success", text: `"${draft.name.trim()}" added.` });
      await loadCategories();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to add category.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function patchCategory(id: number, payload: Record<string, unknown>, successText: string) {
    try {
      setBusyId(id);
      setFeedback(null);
      const response = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to update category."));
      }

      setFeedback({ type: "success", text: successText });
      await loadCategories();
      return true;
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to update category.",
      });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(id: number) {
    if (editDraft.name.trim() === "" || normaliseImageUrl(editDraft.imageUrl) === null) {
      setFeedback({ type: "error", text: "Name and a valid image URL are required." });
      return;
    }

    const saved = await patchCategory(
      id,
      {
        name: editDraft.name,
        imageUrl: editDraft.imageUrl,
        number: editDraft.number.trim() === "" ? undefined : Number(editDraft.number),
      },
      "Category updated.",
    );

    if (saved) {
      setEditingId(null);
    }
  }

  async function deleteCategory(category: AdminCategory) {
    if (!window.confirm(`Delete "${category.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setBusyId(category.id);
      setFeedback(null);
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to delete category."));
      }

      setFeedback({ type: "success", text: `"${category.name}" deleted.` });
      await loadCategories();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to delete category.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Manage Categories</h1>
            <p className="text-sm text-slate-500">
              Categories added here show up on the sale screen straight away.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sale Page
            </Link>
            <Link
              href="/category-sales"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Reports
            </Link>
          </div>
        </div>

        {feedback ? (
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Add a category</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[90px_1fr_1.4fr_auto]">
            <label className="text-sm text-slate-700">
              Number
              <input
                value={draft.number}
                onChange={(event) => setDraft({ ...draft, number: event.target.value })}
                placeholder={String(nextNumber)}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Name
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="e.g. Bags"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Image URL
              <input
                value={draft.imageUrl}
                onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
                placeholder="https://images.unsplash.com/photo-... or /images/bags.jpg"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <div className="flex items-end gap-3">
              <ImagePreview url={draft.imageUrl} alt="New category preview" />
              <button
                type="button"
                onClick={createCategory}
                disabled={creating}
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Leave the number blank to use the next free one ({nextNumber}).
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Categories ({categories.length})
          </h2>

          {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}

          {!loading && categories.length === 0 ? (
            <p className="text-sm text-slate-500">
              No categories yet. Add one above, or run <code>npm run db:seed</code> for the defaults.
            </p>
          ) : null}

          <div className="space-y-2">
            {categories.map((category) => {
              const isEditing = editingId === category.id;
              const isBusy = busyId === category.id;

              return (
                <div
                  key={category.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                    category.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-75"
                  }`}
                >
                  <ImagePreview
                    url={isEditing ? editDraft.imageUrl : category.imageUrl}
                    alt={category.name}
                  />

                  {isEditing ? (
                    <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-[90px_1fr_1.4fr]">
                      <input
                        value={editDraft.number}
                        onChange={(event) => setEditDraft({ ...editDraft, number: event.target.value })}
                        inputMode="numeric"
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      />
                      <input
                        value={editDraft.name}
                        onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      />
                      <input
                        value={editDraft.imageUrl}
                        onChange={(event) =>
                          setEditDraft({ ...editDraft, imageUrl: event.target.value })
                        }
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        #{category.number} · {category.name}
                        {category.isActive ? null : (
                          <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                            Inactive
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">{category.imageUrl}</p>
                      <p className="text-xs text-slate-400">{category.salesCount} sale record(s)</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void saveEdit(category.id)}
                          disabled={isBusy}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {isBusy ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(category.id);
                            setEditDraft({
                              number: String(category.number),
                              name: category.name,
                              imageUrl: category.imageUrl,
                            });
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void patchCategory(
                              category.id,
                              { isActive: !category.isActive },
                              category.isActive
                                ? `"${category.name}" hidden from the sale screen.`
                                : `"${category.name}" is back on the sale screen.`,
                            )
                          }
                          disabled={isBusy}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {category.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteCategory(category)}
                          disabled={isBusy || category.salesCount > 0}
                          title={
                            category.salesCount > 0
                              ? "This category has sales history — deactivate it instead."
                              : undefined
                          }
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

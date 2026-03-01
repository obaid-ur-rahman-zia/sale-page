"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

type Category = {
  id: number;
  number: number;
  name: string;
  imageUrl: string;
};

type Salesman = {
  id: number;
  name: string;
};

type SaleItem = {
  categoryId: number;
  categoryName: string;
  amount: number;
  discount: number;
};

function generateSaleId() {
  const now = new Date();
  const datePart = now
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
  const randomPart = Math.floor(Math.random() * 9000 + 1000);

  return `SAL-${datePart}-${randomPart}`;
}

const keypadItems = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "DEL"] as const;

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleId, setSaleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  useEffect(() => {
    setSaleId(generateSaleId());
    void fetchCategories();
    void fetchSalesmen();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      amountInputRef.current?.focus();
    }
  }, [selectedCategoryId]);

  async function fetchCategories() {
    try {
      const response = await fetch("/api/categories", { cache: "no-store" });
      const data = (await response.json()) as { categories: Category[] };
      setCategories(data.categories ?? []);
    } catch {
      setFeedback({ type: "error", text: "Unable to load categories." });
    }
  }

  async function fetchSalesmen() {
    try {
      const response = await fetch("/api/salesmen", { cache: "no-store" });
      const data = (await response.json()) as { salesmen: Salesman[] };
      setSalesmen(data.salesmen ?? []);
      if ((data.salesmen ?? []).length > 0) {
        setSelectedSalesmanId(data.salesmen[0].id);
      }
    } catch {
      setFeedback({ type: "error", text: "Unable to load salesmen." });
    }
  }

  function handleKeypadTap(key: (typeof keypadItems)[number]) {
    setFeedback(null);
    setAmountInput((previous) => {
      if (key === "DEL") {
        return previous.slice(0, -1);
      }

      if (key === "00") {
        if (previous === "" || previous === "0") {
          return "0";
        }
        return `${previous}00`;
      }

      if (previous === "0") {
        return key;
      }
      return `${previous}${key}`;
    });
  }

  function clearForm() {
    setAmountInput("");
    setDiscountInput("");
    setSelectedCategoryId(null);
    setSaleItems([]);
    setFeedback(null);
  }

  function addItem() {
    if (!selectedCategoryId) {
      setFeedback({ type: "error", text: "Please select a category before adding an item." });
      return;
    }

    const parsedAmount = Number(amountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFeedback({ type: "error", text: "Please enter a valid amount." });
      return;
    }
    const parsedDiscount = discountInput.trim() === "" ? 0 : Number(discountInput);
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > parsedAmount) {
      setFeedback({ type: "error", text: "Discount must be between 0 and amount." });
      return;
    }

    if (!selectedCategory) {
      setFeedback({ type: "error", text: "Selected category is invalid." });
      return;
    }

    setSaleItems((previous) => [
      ...previous,
      {
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        amount: parsedAmount,
        discount: parsedDiscount,
      },
    ]);
    setAmountInput("");
    setDiscountInput("");
    setSelectedCategoryId(null);
    setFeedback({ type: "success", text: "Item added to the sale list." });
  }

  function removeItem(indexToRemove: number) {
    setSaleItems((previous) => previous.filter((_, index) => index !== indexToRemove));
  }

  const saleTotal = useMemo(
    () => saleItems.reduce((sum, item) => sum + (item.amount - item.discount), 0),
    [saleItems],
  );
  const visibleItems = saleItems.slice(0, 4);
  const hiddenItemsCount = Math.max(0, saleItems.length - visibleItems.length);

  async function saveSale() {
    if (saleItems.length === 0) {
      setFeedback({ type: "error", text: "Add at least one item before saving." });
      return;
    }
    if (!selectedSalesmanId) {
      setFeedback({ type: "error", text: "Please select a salesman before saving." });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId,
          salesmanId: selectedSalesmanId,
          items: saleItems.map((item) => ({
            categoryId: item.categoryId,
            amount: item.amount,
            discount: item.discount,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message ?? "Unable to save sale.");
      }

      setFeedback({ type: "success", text: "Sale saved successfully." });
      setSaleId(generateSaleId());
      setAmountInput("");
      setDiscountInput("");
      setSelectedCategoryId(null);
      setSaleItems([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      setFeedback({ type: "error", text: message });
    } finally {
      setSaving(false);
    }
  }

  function handleAmountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      if (!saving) {
        void saveSale();
      }
      return;
    }

    addItem();
  }

  return (
    <main className="h-screen overflow-hidden p-2 md:p-3">
      <div className="mx-auto grid h-full w-full max-w-7xl gap-3 lg:grid-cols-[340px_320px_1fr]">
        <section className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold text-slate-900">Sale Entry</h1>
              <Link
                href="/category-sales"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Category Sales Page
              </Link>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-3">
              <label className="block text-sm font-medium text-slate-700">
                Sale ID
                <input
                  value={saleId}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Category Name
                <input
                  value={selectedCategory?.name ?? ""}
                  readOnly
                  placeholder="Select a category from the right side"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Salesman
                <select
                  value={selectedSalesmanId ?? ""}
                  onChange={(event) => setSelectedSalesmanId(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {salesmen.length === 0 ? <option value="">No salesman found</option> : null}
                  {salesmen.map((salesman) => (
                    <option key={salesman.id} value={salesman.id}>
                      {salesman.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Amount
                <input
                  ref={amountInputRef}
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  onKeyDown={handleAmountKeyDown}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Discount
                <input
                  value={discountInput}
                  onChange={(event) => setDiscountInput(event.target.value)}
                  onKeyDown={handleAmountKeyDown}
                  placeholder="0"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {keypadItems.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeypadTap(key)}
                  className="h-10 rounded-lg border border-slate-300 bg-slate-100 text-base font-semibold text-slate-800 transition hover:bg-slate-200"
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={addItem}
                className="h-10 rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={saveSale}
                disabled={saving}
                className="h-10 rounded-lg bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={clearForm}
                className="h-10 rounded-lg bg-slate-700 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 rounded-lg bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Print
              </button>
            </div>

            {feedback ? (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {feedback.text}
              </div>
            ) : null}
          </div>
        </section>


        <section className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Items in Sale ID</h2>
              <p className="text-sm font-semibold text-slate-800">Total: {saleTotal.toFixed(2)}</p>
            </div>
            <div className="flex-1 rounded-xl border border-slate-200 p-3">
              {saleItems.length === 0 ? (
                <p className="text-sm text-slate-500">No items added yet.</p>
              ) : (
                <div className="space-y-2">
                  {visibleItems.map((item, index) => (
                    <div
                      key={`${item.categoryId}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.categoryName}</p>
                        <p className="text-xs text-slate-500">
                          {item.amount.toFixed(2)} - {item.discount.toFixed(2)} ={" "}
                          {(item.amount - item.discount).toFixed(2)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {hiddenItemsCount > 0 ? (
                    <p className="text-xs text-slate-500">+{hiddenItemsCount} more item(s) in this sale.</p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>

        
        <section className="h-full">
          <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Categories</h2>
            <div className="grid flex-1 grid-cols-3 gap-2">
              {categories.map((category) => {
                const isSelected = selectedCategoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={`cursor-pointer rounded-xl border text-left transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="relative h-20 w-full overflow-hidden rounded-t-xl">
                      <Image
                        src={category.imageUrl}
                        alt={category.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium text-slate-500">Category #{category.number}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{category.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

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

type BillResponse = {
  saleId: string;
  salesman: { id: number; name: string } | null;
  createdAt: string;
  items: Array<{
    id: number;
    categoryId: number;
    categoryNumber: number;
    categoryName: string;
    amount: number;
    discount: number;
    net: number;
  }>;
  totals: {
    grossAmount: number;
    totalDiscount: number;
    netAmount: number;
  };
};

const keypadItems = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "DEL"] as const;
const saleIdPattern = /^sale-(\d+)$/i;

function getNextSaleId(currentSaleId: string | null) {
  if (!currentSaleId) {
    return "sale-1";
  }

  const match = saleIdPattern.exec(currentSaleId.trim());
  if (!match) {
    return "sale-1";
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) {
    return "sale-1";
  }

  return `sale-${value + 1}`;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleId, setSaleId] = useState("");
  const [lastSavedSaleId, setLastSavedSaleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoPrintAfterSave, setAutoPrintAfterSave] = useState(false);
  const [preferredPrinter, setPreferredPrinter] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeKeypadInput, setActiveKeypadInput] = useState<"amount" | "discount">("amount");
  const amountInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const fetchLatestSaleId = useCallback(async () => {
    try {
      const response = await fetch("/api/sales/bill?previous=1", { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const bill = (await response.json()) as BillResponse;
      return bill.saleId || null;
    } catch {
      return null;
    }
  }, []);

  const initializeSaleId = useCallback(async () => {
    const latestSaleId = await fetchLatestSaleId();
    setLastSavedSaleId(latestSaleId);
    setSaleId(getNextSaleId(latestSaleId));
  }, [fetchLatestSaleId]);

  useEffect(() => {
    void initializeSaleId();
    void fetchCategories();
    void fetchSalesmen();
    const savedPrinter = window.localStorage.getItem("preferredPrinter");
    if (savedPrinter) {
      setPreferredPrinter(savedPrinter);
    }
    const autoPrintSaved = window.localStorage.getItem("autoPrintAfterSave");
    if (autoPrintSaved === "1") {
      setAutoPrintAfterSave(true);
    }
  }, [initializeSaleId]);

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
      if ((data.salesmen ?? []).length > 0) {
        setSelectedSalesmanId(data.salesmen[0].id);
      }
    } catch {
      setFeedback({ type: "error", text: "Unable to load salesmen." });
    }
  }

  function handleKeypadTap(key: (typeof keypadItems)[number]) {
    setFeedback(null);
    const setTargetInput = activeKeypadInput === "discount" ? setDiscountInput : setAmountInput;
    setTargetInput((previous) => {
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

  const saleTotals = useMemo(
    () =>
      saleItems.reduce(
        (totals, item) => {
          totals.gross += item.amount;
          totals.discount += item.discount;
          totals.net += item.amount - item.discount;
          return totals;
        },
        { gross: 0, discount: 0, net: 0 },
      ),
    [saleItems],
  );
  const visibleItems = saleItems.slice(0, 4);
  const hiddenItemsCount = Math.max(0, saleItems.length - visibleItems.length);

  function renderInvoiceHtml(bill: BillResponse) {
    const rows = bill.items
      .map(
        (item) =>
          `<tr>
            <td>${item.categoryNumber}</td>
            <td>${item.categoryName}</td>
            <td style="text-align:right">${item.amount.toFixed(2)}</td>
            <td style="text-align:right">${item.discount.toFixed(2)}</td>
            <td style="text-align:right">${item.net.toFixed(2)}</td>
          </tr>`,
      )
      .join("");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${bill.saleId}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      .meta { margin-bottom: 12px; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 6px; }
      th { background: #f3f4f6; text-align: left; }
      .totals { margin-top: 12px; font-size: 13px; }
      .totals p { margin: 4px 0; text-align: right; }
      .net { font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Sales Invoice</h1>
    <div class="meta">
      <div><strong>Sale ID:</strong> ${bill.saleId}</div>
      <div><strong>Date:</strong> ${new Date(bill.createdAt).toLocaleString()}</div>
      <div><strong>Preferred Printer:</strong> ${preferredPrinter || "System Default"}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Category</th>
          <th>Amount</th>
          <th>Discount</th>
          <th>Net</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <p>Gross: ${bill.totals.grossAmount.toFixed(2)}</p>
      <p>Discount: ${bill.totals.totalDiscount.toFixed(2)}</p>
      <p class="net">Net: ${bill.totals.netAmount.toFixed(2)}</p>
    </div>
  </body>
</html>`;
  }

  function printInvoice(bill: BillResponse) {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      setFeedback({ type: "error", text: "Pop-up blocked. Please allow pop-ups to print invoices." });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(renderInvoiceHtml(bill));
    printWindow.document.close();
    printWindow.focus();
    // Browser security does not allow true silent printing or printer selection from web apps.
    printWindow.print();
    printWindow.close();
  }

  async function printPreviousBill() {
    try {
      const defaultSaleId = lastSavedSaleId ?? (await fetchLatestSaleId()) ?? "sale-1";
      const enteredSaleId = window.prompt("Enter sale ID", defaultSaleId)?.trim();

      if (!enteredSaleId) {
        return;
      }

      const response = await fetch(`/api/sales/bill?saleId=${encodeURIComponent(enteredSaleId)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message ?? "Unable to load previous bill.");
      }
      const bill = (await response.json()) as BillResponse;
      setLastSavedSaleId(bill.saleId);
      printInvoice(bill);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to print previous bill.";
      setFeedback({ type: "error", text: message });
    }
  }

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
      const currentSaleId = saleId;

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: currentSaleId,
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

      setLastSavedSaleId(currentSaleId);
      setFeedback({
        type: "success",
        text: "Sale saved successfully. Note: Browsers show a print dialog; silent print requires kiosk/native setup.",
      });
      setSaleId(getNextSaleId(currentSaleId));
      setAmountInput("");
      setDiscountInput("");
      setSelectedCategoryId(null);
      setSaleItems([]);

      if (autoPrintAfterSave) {
        const billResponse = await fetch(`/api/sales/bill?saleId=${encodeURIComponent(currentSaleId)}`, {
          cache: "no-store",
        });
        if (billResponse.ok) {
          const bill = (await billResponse.json()) as BillResponse;
          printInvoice(bill);
        }
      }
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
            
            <div className="space-y-3 rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-2 items-center justify-between">
                <input
                  value={selectedCategory?.name ?? ""}
                  readOnly
                  placeholder="Select a category from the right side"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none"
                />

                <label className="block text-sm font-medium text-slate-700">
                  <input
                    ref={amountInputRef}
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                    onFocus={() => setActiveKeypadInput("amount")}
                    onClick={() => setActiveKeypadInput("amount")}
                    onKeyDown={handleAmountKeyDown}
                    placeholder="0.00"
                    inputMode="none"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </label>
                {/* Salesman selector hidden on request */}
                {/* <label className="block text-sm font-medium text-slate-700">
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
              </label> */}

              </div>



              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoPrintAfterSave}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setAutoPrintAfterSave(checked);
                      window.localStorage.setItem("autoPrintAfterSave", checked ? "1" : "0");
                    }}
                  />
                  Auto-print invoice
                </label>
                <input
                  value={preferredPrinter}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPreferredPrinter(value);
                    window.localStorage.setItem("preferredPrinter", value);
                  }}
                  placeholder="Preferred printer name"
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {keypadItems.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeypadTap(key)}
                  className="h-14 rounded-lg border border-slate-300 bg-slate-100 text-lg font-semibold text-slate-800 transition hover:bg-slate-200"
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={addItem}
                className="h-32 rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={saveSale}
                disabled={saving}
                className="h-32 rounded-lg bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                onClick={printPreviousBill}
                className="h-10 rounded-lg bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Previous Bill
              </button>
            </div>

            {feedback ? (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${feedback.type === "success"
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
          <div className="flex items-center justify-between gap-3">
              <Link
                href="/category-sales"
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                title="Category Sales Page"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
                  <path d="M4 4h16v2H4V4zm2 5h3v11H6V9zm5 3h3v8h-3v-8zm5-5h3v13h-3V7z" />
                </svg>
                <span>{saleId}</span>
              </Link>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Items in Sale ID</h2>
              <div className="text-right text-xs text-slate-700">
                {/* <p>Gross: {saleTotals.gross.toFixed(2)}</p>
                <p>Discount: {saleTotals.discount.toFixed(2)}</p> */}
                <p className="text-sm font-semibold text-slate-800">Total: {saleTotals.net.toFixed(2)}</p>
                <label className="mt-1 inline-flex items-center justify-end gap-2 text-xs font-medium text-slate-700">
                  <span>Discount Input:</span>
                  <input
                    value={discountInput}
                    onChange={(event) => setDiscountInput(event.target.value)}
                    onFocus={() => setActiveKeypadInput("discount")}
                    onClick={() => setActiveKeypadInput("discount")}
                    onKeyDown={handleAmountKeyDown}
                    placeholder="0"
                    inputMode="none"
                    readOnly
                    className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
                  />
                </label>
              </div>
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
            <div className="grid grid-cols-3 gap-2">
              {categories.map((category) => {
                const isSelected = selectedCategoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={`cursor-pointer rounded-xl border text-left transition ${isSelected
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

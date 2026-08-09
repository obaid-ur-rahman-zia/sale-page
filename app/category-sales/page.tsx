"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { APP_TIME_ZONE, addDaysToIsoDate, isoDateInZone } from "@/lib/time-zone";

type CategorySummary = {
  categoryId: number;
  number: number;
  name: string;
  isActive: boolean;
  grossAmount: number;
  totalDiscount: number;
  totalAmount: number;
  totalSales: number;
};

type SalesSummaryResponse = {
  overall: {
    grossAmount: number;
    totalDiscount: number;
    totalAmount: number;
    totalSales: number;
    totalBills: number;
  };
  byCategory: CategorySummary[];
};

type SaleHistoryItem = {
  saleId: string;
  createdAt: string;
  salesmanName: string;
  totalItems: number;
  grossAmount: number;
  totalDiscount: number;
  netAmount: number;
};

type BillResponse = {
  saleId: string;
  createdAt: string;
  items: Array<{
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

type FilterOption = { id: number; name: string };

const emptySummary: SalesSummaryResponse = {
  overall: { grossAmount: 0, totalDiscount: 0, totalAmount: 0, totalSales: 0, totalBills: 0 },
  byCategory: [],
};

function startOfMonth(isoDate: string) {
  return `${isoDate.slice(0, 7)}-01`;
}

export default function CategorySalesPage() {
  const [summary, setSummary] = useState<SalesSummaryResponse>(emptySummary);
  const [saleHistory, setSaleHistory] = useState<SaleHistoryItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<FilterOption[]>([]);
  const [salesmanOptions, setSalesmanOptions] = useState<FilterOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"category" | "sales">("category");
  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [saleIdInput, setSaleIdInput] = useState("");
  const [saleIdQuery, setSaleIdQuery] = useState("");

  // Keeps a slow response from a previous filter state from overwriting a newer one.
  const requestRef = useRef<AbortController | null>(null);

  const today = useMemo(() => isoDateInZone(new Date()), []);

  // The sale ID box filters as you type, but only after typing settles.
  useEffect(() => {
    const timer = window.setTimeout(() => setSaleIdQuery(saleIdInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [saleIdInput]);

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (fromDate) query.set("from", fromDate);
    if (toDate) query.set("to", toDate);
    if (categoryId) query.set("categoryId", categoryId);
    if (salesmanId) query.set("salesmanId", salesmanId);
    if (saleIdQuery) query.set("saleId", saleIdQuery);
    return query.toString();
  }, [categoryId, fromDate, salesmanId, saleIdQuery, toDate]);

  const hasActiveFilters = queryString.length > 0;
  const datesAreReversed = Boolean(fromDate && toDate && fromDate > toDate);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [categoriesResponse, salesmenResponse] = await Promise.all([
          fetch("/api/categories?includeInactive=1", { cache: "no-store" }),
          fetch("/api/salesmen", { cache: "no-store" }),
        ]);

        if (categoriesResponse.ok) {
          const data = (await categoriesResponse.json()) as {
            categories: Array<{ id: number; number: number; name: string }>;
          };
          setCategoryOptions(
            (data.categories ?? []).map((category) => ({
              id: category.id,
              name: `#${category.number} ${category.name}`,
            })),
          );
        }

        if (salesmenResponse.ok) {
          const data = (await salesmenResponse.json()) as { salesmen: FilterOption[] };
          setSalesmanOptions(data.salesmen ?? []);
        }
      } catch {
        // Filter dropdowns are optional; the report itself still works without them.
      }
    }

    void loadOptions();
  }, []);

  const loadReport = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const [summaryResponse, historyResponse] = await Promise.all([
        fetch(`/api/sales/summary?${queryString}`, {
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch(`/api/sales/history?${queryString}`, {
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);

      if (!summaryResponse.ok) {
        throw new Error("Unable to load sales summary.");
      }
      if (!historyResponse.ok) {
        throw new Error("Unable to load sale history.");
      }

      const summaryData = (await summaryResponse.json()) as SalesSummaryResponse;
      const historyData = (await historyResponse.json()) as { sales: SaleHistoryItem[] };

      setSummary(summaryData);
      setSaleHistory(historyData.sales ?? []);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Unexpected error");
    } finally {
      if (requestRef.current === controller) {
        setLoading(false);
        requestRef.current = null;
      }
    }
  }, [queryString]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  function applyPreset(preset: "today" | "yesterday" | "last7" | "month") {
    if (preset === "today") {
      setFromDate(today);
      setToDate(today);
      return;
    }
    if (preset === "yesterday") {
      const yesterday = addDaysToIsoDate(today, -1) ?? today;
      setFromDate(yesterday);
      setToDate(yesterday);
      return;
    }
    if (preset === "last7") {
      setFromDate(addDaysToIsoDate(today, -6) ?? today);
      setToDate(today);
      return;
    }
    setFromDate(startOfMonth(today));
    setToDate(today);
  }

  function clearFilters() {
    setFromDate("");
    setToDate("");
    setCategoryId("");
    setSalesmanId("");
    setSaleIdInput("");
    setSaleIdQuery("");
  }

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

  async function printSaleById(saleId: string) {
    try {
      setPrintingSaleId(saleId);
      const response = await fetch(`/api/sales/bill?saleId=${encodeURIComponent(saleId)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Unable to load this sale bill.");
      }
      const bill = (await response.json()) as BillResponse;
      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) {
        throw new Error("Pop-up blocked. Please allow pop-ups to print.");
      }
      printWindow.document.open();
      printWindow.document.write(renderInvoiceHtml(bill));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : "Unable to print this sale.");
    } finally {
      setPrintingSaleId(null);
    }
  }

  const presetButtons = [
    { key: "today" as const, label: "Today" },
    { key: "yesterday" as const, label: "Yesterday" },
    { key: "last7" as const, label: "Last 7 Days" },
    { key: "month" as const, label: "This Month" },
  ];

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Category-Wise Sales</h1>
          <div className="flex gap-2">
            <Link
              href="/admin/categories"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Manage Categories
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back to Sale Page
            </Link>
          </div>
        </div>

        <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap gap-2">
            {presetButtons.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset.key)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear Filters
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm text-slate-700">
              From Date
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => setFromDate(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              To Date
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => setToDate(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
              />
            </label>
            <label className="text-sm text-slate-700">
              Category
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
              >
                <option value="">All categories</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Salesman
              <select
                value={salesmanId}
                onChange={(event) => setSalesmanId(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
              >
                <option value="">All salesmen</option>
                {salesmanOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Sale ID
              <input
                value={saleIdInput}
                onChange={(event) => setSaleIdInput(event.target.value)}
                placeholder="e.g. sale-12"
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
              />
            </label>
          </div>

          <p className="text-xs text-slate-500">
            Dates are whole days in {APP_TIME_ZONE}.
            {datesAreReversed ? " From/To were entered backwards, so the range was swapped." : ""}
            {categoryId
              ? " With a category selected, the sale-wise tab shows only that category's part of each bill."
              : ""}
          </p>
        </div>

        {error ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("category")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                activeTab === "category"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Category-Wise
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sales")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                activeTab === "sales"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Sale-Wise
            </button>
            <span className="text-xs text-slate-500">
              {loading
                ? "Loading..."
                : `${summary.overall.totalBills} bill(s) · ${summary.overall.totalSales} item(s)`}
            </span>
          </div>

          <div className={loading ? "opacity-50 transition" : "transition"}>
            {activeTab === "category" ? (
              <div className="overflow-x-auto">
                <h2 className="mb-2 text-base font-semibold text-slate-900">Category Summary</h2>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Total Items</th>
                      <th className="py-2 text-right">Gross</th>
                      <th className="py-2 text-right">Discount</th>
                      <th className="py-2 text-right">Net Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byCategory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-3 text-center text-slate-500">
                          No categories match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      summary.byCategory.map((item) => (
                        <tr key={item.categoryId} className="border-b border-slate-100">
                          <td className="py-2 pr-3 text-slate-600">{item.number}</td>
                          <td className="py-2 pr-3 font-medium text-slate-800">
                            {item.name}
                            {item.isActive ? null : (
                              <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{item.totalSales}</td>
                          <td className="py-2 text-right font-semibold text-slate-800">
                            {item.grossAmount.toFixed(2)}
                          </td>
                          <td className="py-2 text-right font-semibold text-slate-800">
                            {item.totalDiscount.toFixed(2)}
                          </td>
                          <td className="py-2 text-right font-semibold text-slate-800">
                            {item.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="text-slate-900">
                      <td className="pt-3" colSpan={2}>
                        <span className="font-semibold">Overall</span>
                      </td>
                      <td className="pt-3 font-semibold">{summary.overall.totalSales}</td>
                      <td className="pt-3 text-right font-bold">
                        {summary.overall.grossAmount.toFixed(2)}
                      </td>
                      <td className="pt-3 text-right font-bold">
                        {summary.overall.totalDiscount.toFixed(2)}
                      </td>
                      <td className="pt-3 text-right font-bold">
                        {summary.overall.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <h2 className="mb-2 text-base font-semibold text-slate-900">Sale-Wise History</h2>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-3">Sale ID</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Salesman</th>
                      <th className="py-2 pr-3">Items</th>
                      <th className="py-2 text-right">Gross</th>
                      <th className="py-2 text-right">Discount</th>
                      <th className="py-2 text-right">Net</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-3 text-center text-slate-500">
                          No sales found for selected filters.
                        </td>
                      </tr>
                    ) : (
                      saleHistory.map((sale) => (
                        <tr key={sale.saleId} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-semibold text-slate-800">{sale.saleId}</td>
                          <td className="py-2 pr-3 text-slate-600">
                            {new Date(sale.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{sale.salesmanName}</td>
                          <td className="py-2 pr-3 text-slate-600">{sale.totalItems}</td>
                          <td className="py-2 text-right font-semibold text-slate-800">
                            {sale.grossAmount.toFixed(2)}
                          </td>
                          <td className="py-2 text-right font-semibold text-slate-800">
                            {sale.totalDiscount.toFixed(2)}
                          </td>
                          <td className="py-2 text-right font-semibold text-slate-800">
                            {sale.netAmount.toFixed(2)}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void printSaleById(sale.saleId)}
                              disabled={printingSaleId === sale.saleId}
                              className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {printingSaleId === sale.saleId ? "Printing..." : "Print"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

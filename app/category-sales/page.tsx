"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CategorySummary = {
  categoryId: number;
  number: number;
  name: string;
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
  };
  byCategory: CategorySummary[];
};

export default function CategorySalesPage() {
  const [summary, setSummary] = useState<SalesSummaryResponse>({
    overall: { grossAmount: 0, totalDiscount: 0, totalAmount: 0, totalSales: 0 },
    byCategory: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (fromDate) {
        query.set("from", fromDate);
      }
      if (toDate) {
        query.set("to", toDate);
      }
      const response = await fetch(`/api/sales/summary?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load sales summary.");
      }
      const data = (await response.json()) as SalesSummaryResponse;
      setSummary(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unexpected error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Category-Wise Sales</h1>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back to Sale Page
          </Link>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
          <label className="text-sm text-slate-700">
            From Date
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
            />
          </label>
          <label className="text-sm text-slate-700">
            To Date
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            className="h-10 self-end rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Clear Filters
          </button>
        </div>

        {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading && !error ? (
          <div className="overflow-x-auto">
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
                {summary.byCategory.map((item) => (
                  <tr key={item.categoryId} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-600">{item.number}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{item.name}</td>
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
                ))}
              </tbody>
              <tfoot>
                <tr className="text-slate-900">
                  <td className="pt-3" colSpan={2}>
                    <span className="font-semibold">Overall</span>
                  </td>
                  <td className="pt-3 font-semibold">{summary.overall.totalSales}</td>
                  <td className="pt-3 text-right font-bold">{summary.overall.grossAmount.toFixed(2)}</td>
                  <td className="pt-3 text-right font-bold">{summary.overall.totalDiscount.toFixed(2)}</td>
                  <td className="pt-3 text-right font-bold">{summary.overall.totalAmount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>
    </main>
  );
}

import { NextResponse } from "next/server";

import { loadSaleLines, parseReportFilters, summariseBySale } from "@/lib/sales-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseReportFilters(searchParams);
    const lines = await loadSaleLines(filters);

    // With a category filter active these totals cover only that category's rows,
    // which is what makes this tab add up to the category tab.
    return NextResponse.json({ filters, sales: summariseBySale(lines) });
  } catch (error) {
    console.error("Failed to fetch sale history:", error);
    return NextResponse.json({ message: "Failed to fetch sale history" }, { status: 500 });
  }
}

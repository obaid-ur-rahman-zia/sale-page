import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  loadSaleLines,
  parseReportFilters,
  summariseByCategory,
  summariseOverall,
} from "@/lib/sales-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseReportFilters(searchParams);

    const [lines, categories] = await Promise.all([
      loadSaleLines(filters),
      prisma.category.findMany({
        orderBy: { number: "asc" },
        select: { id: true, number: true, name: true, isActive: true },
      }),
    ]);

    const totalsByCategory = summariseByCategory(lines);

    const byCategory = categories
      .filter((category) => {
        if (filters.categoryId) {
          return category.id === filters.categoryId;
        }
        // Retired categories stay out of the report unless they actually sold
        // something inside the selected range.
        return category.isActive || totalsByCategory.has(category.id);
      })
      .map((category) => {
        const totals = totalsByCategory.get(category.id);
        return {
          categoryId: category.id,
          number: category.number,
          name: category.name,
          isActive: category.isActive,
          grossAmount: totals?.grossAmount ?? 0,
          totalDiscount: totals?.totalDiscount ?? 0,
          totalAmount: totals?.totalAmount ?? 0,
          totalSales: totals?.totalSales ?? 0,
        };
      });

    return NextResponse.json({
      filters,
      overall: summariseOverall(lines),
      byCategory,
    });
  } catch (error) {
    console.error("Failed to fetch sales summary:", error);
    return NextResponse.json({ message: "Failed to fetch summary" }, { status: 500 });
  }
}

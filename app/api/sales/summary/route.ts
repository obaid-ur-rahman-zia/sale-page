import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [categories, groupedSales, totals] = await Promise.all([
      prisma.category.findMany({
        orderBy: { number: "asc" },
        select: { id: true, number: true, name: true },
      }),
      prisma.sale.groupBy({
        by: ["categoryId"],
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.sale.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const groupedMap = new Map(
      groupedSales.map((item) => [
        item.categoryId,
        {
          totalAmount: item._sum.amount ?? 0,
          totalSales: item._count._all,
        },
      ]),
    );

    const byCategory = categories.map((category) => {
      const stats = groupedMap.get(category.id);
      return {
        categoryId: category.id,
        number: category.number,
        name: category.name,
        totalAmount: stats?.totalAmount ?? 0,
        totalSales: stats?.totalSales ?? 0,
      };
    });

    return NextResponse.json({
      overall: {
        totalAmount: totals._sum.amount ?? 0,
        totalSales: totals._count._all,
      },
      byCategory,
    });
  } catch (error) {
    console.error("Failed to fetch sales summary:", error);
    return NextResponse.json({ message: "Failed to fetch summary" }, { status: 500 });
  }
}

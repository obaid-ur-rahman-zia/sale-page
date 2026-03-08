import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function buildDateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from && !to) {
    return undefined;
  }

  const createdAt: { gte?: Date; lte?: Date } = {};

  if (from) {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    if (!Number.isNaN(fromDate.getTime())) {
      createdAt.gte = fromDate;
    }
  }

  if (to) {
    const toDate = new Date(`${to}T23:59:59.999Z`);
    if (!Number.isNaN(toDate.getTime())) {
      createdAt.lte = toDate;
    }
  }

  if (!createdAt.gte && !createdAt.lte) {
    return undefined;
  }

  return createdAt;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const createdAt = buildDateRange(searchParams);
    const where = createdAt ? { createdAt } : undefined;

    const prismaWithSaleBill = prisma as typeof prisma & {
      saleBill?: {
        aggregate: (args: {
          where?: { createdAt?: { gte?: Date; lte?: Date } };
          _sum: { totalDiscount: true };
        }) => Promise<{ _sum: { totalDiscount: number | null } }>;
      };
    };

    const [categories, groupedSales, totals, saleLevelDiscountTotals] = await Promise.all([
      prisma.category.findMany({
        orderBy: { number: "asc" },
        select: { id: true, number: true, name: true },
      }),
      prisma.sale.groupBy({
        by: ["categoryId"],
        where,
        _sum: { amount: true, discount: true },
        _count: { _all: true },
      }),
      prisma.sale.aggregate({
        where,
        _sum: { amount: true, discount: true },
        _count: { _all: true },
      }),
      prismaWithSaleBill.saleBill?.aggregate
        ? prismaWithSaleBill.saleBill.aggregate({
            where: createdAt ? { createdAt } : undefined,
            _sum: { totalDiscount: true },
          })
        : Promise.resolve({ _sum: { totalDiscount: 0 } }),
    ]);

    const groupedMap = new Map(
      groupedSales.map((item) => [
        item.categoryId,
        {
          grossAmount: item._sum.amount ?? 0,
          totalDiscount: item._sum.discount ?? 0,
          totalAmount: (item._sum.amount ?? 0) - (item._sum.discount ?? 0),
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
        grossAmount: stats?.grossAmount ?? 0,
        totalDiscount: stats?.totalDiscount ?? 0,
        totalAmount: stats?.totalAmount ?? 0,
        totalSales: stats?.totalSales ?? 0,
      };
    });

    return NextResponse.json({
      overall: {
        grossAmount: totals._sum.amount ?? 0,
        totalDiscount: (totals._sum.discount ?? 0) + (saleLevelDiscountTotals._sum.totalDiscount ?? 0),
        totalAmount:
          (totals._sum.amount ?? 0) -
          ((totals._sum.discount ?? 0) + (saleLevelDiscountTotals._sum.totalDiscount ?? 0)),
        totalSales: totals._count._all,
      },
      byCategory,
    });
  } catch (error) {
    console.error("Failed to fetch sales summary:", error);
    return NextResponse.json({ message: "Failed to fetch summary" }, { status: 500 });
  }
}

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

type SaleHistoryItem = {
  saleId: string;
  createdAt: Date;
  salesmanName: string;
  totalItems: number;
  grossAmount: number;
  totalDiscount: number;
  netAmount: number;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const createdAt = buildDateRange(searchParams);
    const where = createdAt ? { createdAt } : undefined;

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        saleId: true,
        amount: true,
        discount: true,
        createdAt: true,
        salesman: {
          select: { name: true },
        },
      },
    });

    const grouped = new Map<string, SaleHistoryItem>();
    for (const sale of sales) {
      const existing = grouped.get(sale.saleId);
      if (!existing) {
        grouped.set(sale.saleId, {
          saleId: sale.saleId,
          createdAt: sale.createdAt,
          salesmanName: sale.salesman?.name ?? "N/A",
          totalItems: 1,
          grossAmount: sale.amount,
          totalDiscount: sale.discount,
          netAmount: sale.amount - sale.discount,
        });
        continue;
      }

      if (sale.createdAt > existing.createdAt) {
        existing.createdAt = sale.createdAt;
      }
      existing.totalItems += 1;
      existing.grossAmount += sale.amount;
      existing.totalDiscount += sale.discount;
      existing.netAmount += sale.amount - sale.discount;
    }

    const history = [...grouped.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const saleIds = history.map((item) => item.saleId);
    const prismaWithSaleBill = prisma as typeof prisma & {
      saleBill?: {
        findMany: (args: {
          where: { saleId: { in: string[] } };
          select: { saleId: true; totalDiscount: true };
        }) => Promise<Array<{ saleId: string; totalDiscount: number }>>;
      };
    };

    if (saleIds.length > 0 && prismaWithSaleBill.saleBill?.findMany) {
      const billDiscounts = await prismaWithSaleBill.saleBill.findMany({
        where: { saleId: { in: saleIds } },
        select: { saleId: true, totalDiscount: true },
      });
      const discountMap = new Map(
        billDiscounts.map((item) => [item.saleId, item.totalDiscount]),
      );

      for (const item of history) {
        const billDiscount = discountMap.get(item.saleId);
        if (billDiscount === undefined) {
          continue;
        }
        item.totalDiscount = billDiscount;
        item.netAmount = item.grossAmount - billDiscount;
      }
    }

    return NextResponse.json({ sales: history });
  } catch (error) {
    console.error("Failed to fetch sale history:", error);
    return NextResponse.json({ message: "Failed to fetch sale history" }, { status: 500 });
  }
}

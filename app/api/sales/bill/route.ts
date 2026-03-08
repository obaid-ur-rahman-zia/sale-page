import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saleId = searchParams.get("saleId")?.trim();
    const previous = searchParams.get("previous") === "1";

    let resolvedSaleId = saleId;

    if (!resolvedSaleId && previous) {
      const latestSale = await prisma.sale.findFirst({
        orderBy: { createdAt: "desc" },
        select: { saleId: true },
      });
      resolvedSaleId = latestSale?.saleId;
    }

    if (!resolvedSaleId) {
      return NextResponse.json({ message: "Sale ID is required" }, { status: 400 });
    }

    const sales = await prisma.sale.findMany({
      where: { saleId: resolvedSaleId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        saleId: true,
        amount: true,
        discount: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
            number: true,
          },
        },
        salesman: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (sales.length === 0) {
      return NextResponse.json({ message: "Sale not found" }, { status: 404 });
    }

    const grossAmount = sales.reduce((sum, item) => sum + item.amount, 0);
    const legacyItemDiscount = sales.reduce((sum, item) => sum + item.discount, 0);
    const prismaWithSaleBill = prisma as typeof prisma & {
      saleBill?: {
        findUnique: (args: {
          where: { saleId: string };
          select: { totalDiscount: true };
        }) => Promise<{ totalDiscount: number } | null>;
      };
    };

    let totalDiscount = legacyItemDiscount;
    if (prismaWithSaleBill.saleBill?.findUnique) {
      const billDiscount = await prismaWithSaleBill.saleBill.findUnique({
        where: { saleId: resolvedSaleId },
        select: { totalDiscount: true },
      });
      totalDiscount = billDiscount?.totalDiscount ?? legacyItemDiscount;
    }
    const netAmount = grossAmount - totalDiscount;

    return NextResponse.json({
      saleId: resolvedSaleId,
      salesman: sales[0].salesman,
      createdAt: sales[sales.length - 1].createdAt,
      items: sales.map((item) => ({
        id: item.id,
        categoryId: item.category.id,
        categoryNumber: item.category.number,
        categoryName: item.category.name,
        amount: item.amount,
        discount: item.discount,
        net: item.amount - item.discount,
      })),
      totals: {
        grossAmount,
        totalDiscount,
        netAmount,
      },
    });
  } catch (error) {
    console.error("Failed to fetch bill:", error);
    return NextResponse.json({ message: "Failed to fetch bill" }, { status: 500 });
  }
}

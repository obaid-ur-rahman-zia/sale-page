import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { allocateDiscount } from "@/lib/sales-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saleId = searchParams.get("saleId")?.trim();
    const previous = searchParams.get("previous") === "1";

    let resolvedSaleId = saleId;

    if (!resolvedSaleId && previous) {
      const latestSale = await prisma.sale.findFirst({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { saleId: true },
      });
      resolvedSaleId = latestSale?.saleId;
    }

    if (!resolvedSaleId) {
      return NextResponse.json({ message: "Sale ID is required" }, { status: 400 });
    }

    const [sales, bill] = await Promise.all([
      prisma.sale.findMany({
        where: { saleId: resolvedSaleId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          saleId: true,
          amount: true,
          discount: true,
          createdAt: true,
          category: { select: { id: true, name: true, number: true } },
          salesman: { select: { id: true, name: true } },
        },
      }),
      prisma.saleBill.findUnique({
        where: { saleId: resolvedSaleId },
        select: { totalDiscount: true },
      }),
    ]);

    if (sales.length === 0) {
      return NextResponse.json({ message: "Sale not found" }, { status: 404 });
    }

    const grossAmount = sales.reduce((sum, item) => sum + item.amount, 0);
    // Sales written before SaleBill existed kept the discount on the rows themselves.
    const legacyItemDiscount = sales.reduce((sum, item) => sum + item.discount, 0);
    const shares = allocateDiscount(
      sales.map((item) => item.amount),
      bill?.totalDiscount ?? legacyItemDiscount,
    );
    const totalDiscount = shares.reduce((sum, share) => sum + share, 0);

    return NextResponse.json({
      saleId: resolvedSaleId,
      salesman: sales[0].salesman,
      createdAt: sales[sales.length - 1].createdAt,
      items: sales.map((item, index) => ({
        id: item.id,
        categoryId: item.category.id,
        categoryNumber: item.category.number,
        categoryName: item.category.name,
        amount: item.amount,
        discount: shares[index],
        net: item.amount - shares[index],
      })),
      totals: {
        grossAmount,
        totalDiscount,
        netAmount: grossAmount - totalDiscount,
      },
    });
  } catch (error) {
    console.error("Failed to fetch bill:", error);
    return NextResponse.json({ message: "Failed to fetch bill" }, { status: 500 });
  }
}

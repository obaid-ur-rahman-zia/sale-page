import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type CreateSalePayload = {
  saleId?: string;
  salesmanId?: number;
  billDiscount?: number;
  categoryId?: number;
  amount?: number;
  items?: Array<{
    categoryId?: number;
    amount?: number;
  }>;
};

function parseSaleNumber(saleId: string) {
  const match = /^sale-(\d+)$/i.exec(saleId.trim());
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

async function generateSaleId() {
  const recentSales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    select: { saleId: true },
    take: 500,
  });

  let maxNumber = 0;
  for (const sale of recentSales) {
    const number = parseSaleNumber(sale.saleId);
    if (number && number > maxNumber) {
      maxNumber = number;
    }
  }

  return `sale-${maxNumber + 1}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSalePayload;
    const providedSaleId = body.saleId?.trim();
    const saleId = providedSaleId && providedSaleId.length > 0 ? providedSaleId : await generateSaleId();
    const salesmanId = Number(body.salesmanId);
    const billDiscount = Number(body.billDiscount ?? 0);
    const items =
      body.items?.map((item) => ({
        categoryId: Number(item.categoryId),
        amount: Number(item.amount),
        discount: 0,
      })) ?? [];

    if (items.length === 0) {
      const categoryId = Number(body.categoryId);
      const amount = Number(body.amount);
      if (Number.isFinite(categoryId) && Number.isFinite(amount)) {
        items.push({ categoryId, amount, discount: 0 });
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ message: "At least one sale item is required" }, { status: 400 });
    }

    const hasInvalidItem = items.some(
      (item) =>
        !Number.isFinite(item.categoryId) || item.categoryId <= 0 || !Number.isFinite(item.amount) || item.amount <= 0,
    );

    if (hasInvalidItem) {
      return NextResponse.json(
        { message: "All items must have valid categoryId and amount" },
        { status: 400 },
      );
    }

    const grossAmount = items.reduce((sum, item) => sum + item.amount, 0);
    if (!Number.isFinite(billDiscount) || billDiscount < 0 || billDiscount > grossAmount) {
      return NextResponse.json({ message: "Bill discount must be between 0 and gross amount" }, { status: 400 });
    }

    if (!Number.isFinite(salesmanId) || salesmanId <= 0) {
      return NextResponse.json({ message: "Valid salesman is required" }, { status: 400 });
    }

    const salesman = await prisma.salesman.findUnique({
      where: { id: salesmanId },
      select: { id: true },
    });

    if (!salesman) {
      return NextResponse.json({ message: "Salesman not found" }, { status: 404 });
    }

    const categoryIds = [...new Set(items.map((item) => item.categoryId))];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    const existingCategoryIds = new Set(categories.map((category) => category.id));
    const missingCategoryId = categoryIds.find((id) => !existingCategoryIds.has(id));

    if (missingCategoryId) {
      return NextResponse.json(
        { message: `Category not found for id ${missingCategoryId}` },
        { status: 404 },
      );
    }

    const createdSales = await prisma.$transaction(async (tx) => {
      const txWithSaleBill = tx as typeof tx & {
        saleBill?: {
          upsert: (args: {
            where: { saleId: string };
            update: { totalDiscount: number };
            create: { saleId: string; totalDiscount: number };
          }) => Promise<unknown>;
        };
      };
      const hasSaleBillModel = Boolean(txWithSaleBill.saleBill?.upsert);

      if (hasSaleBillModel) {
        await txWithSaleBill.saleBill!.upsert({
          where: { saleId },
          update: { totalDiscount: billDiscount },
          create: { saleId, totalDiscount: billDiscount },
        });
      }

      return Promise.all(
        items.map((item, index) =>
          tx.sale.create({
            data: {
              saleId,
              categoryId: item.categoryId,
              amount: item.amount,
              // Fallback for stale dev client: keep bill discount on first row.
              discount: hasSaleBillModel ? 0 : index === 0 ? billDiscount : 0,
              salesmanId,
            },
            select: {
              id: true,
              saleId: true,
              amount: true,
              discount: true,
              categoryId: true,
              salesmanId: true,
              createdAt: true,
            },
          }),
        ),
      );
    });

    return NextResponse.json(
      {
        saleId,
        itemsCreated: createdSales.length,
        sales: createdSales,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create sale:", error);
    return NextResponse.json({ message: "Failed to create sale" }, { status: 500 });
  }
}

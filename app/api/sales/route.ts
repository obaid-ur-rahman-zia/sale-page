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

function parseId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

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
    const salesmanId = parseId(body.salesmanId);
    const billDiscount = Number(body.billDiscount ?? 0);
    const items =
      body.items?.map((item) => ({
        categoryId: parseId(item.categoryId),
        amount: Number(item.amount),
      })) ?? [];

    if (items.length === 0) {
      const categoryId = parseId(body.categoryId);
      const amount = Number(body.amount);
      if (categoryId && Number.isFinite(amount)) {
        items.push({ categoryId, amount });
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ message: "At least one sale item is required" }, { status: 400 });
    }

    const validItems: Array<{ categoryId: number; amount: number }> = [];
    for (const item of items) {
      if (!item.categoryId || !Number.isFinite(item.amount) || item.amount <= 0) {
        return NextResponse.json(
          { message: "All items must have valid categoryId and amount" },
          { status: 400 },
        );
      }
      validItems.push({ categoryId: item.categoryId, amount: item.amount });
    }

    const grossAmount = validItems.reduce((sum, item) => sum + item.amount, 0);
    if (!Number.isFinite(billDiscount) || billDiscount < 0 || billDiscount > grossAmount) {
      return NextResponse.json({ message: "Bill discount must be between 0 and gross amount" }, { status: 400 });
    }

    if (!salesmanId) {
      return NextResponse.json({ message: "Valid salesman is required" }, { status: 400 });
    }

    const salesman = await prisma.salesman.findUnique({
      where: { id: salesmanId },
      select: { id: true },
    });

    if (!salesman) {
      return NextResponse.json({ message: "Salesman not found" }, { status: 404 });
    }

    const categoryIds = [...new Set(validItems.map((item) => item.categoryId))];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, isActive: true },
    });
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const missingCategoryId = categoryIds.find((id) => !categoriesById.has(id));

    if (missingCategoryId) {
      return NextResponse.json(
        { message: `Category not found for id ${missingCategoryId}` },
        { status: 404 },
      );
    }

    const inactiveCategory = categoryIds
      .map((id) => categoriesById.get(id)!)
      .find((category) => !category.isActive);

    if (inactiveCategory) {
      return NextResponse.json(
        { message: `Category "${inactiveCategory.name}" is inactive and cannot be sold` },
        { status: 400 },
      );
    }

    const createdSales = await prisma.$transaction(async (tx) => {
      await tx.saleBill.upsert({
        where: { saleId },
        update: { totalDiscount: billDiscount },
        create: { saleId, totalDiscount: billDiscount },
      });

      // Sequential, not Promise.all: operations inside an interactive transaction
      // share one session and must not run concurrently.
      const created = [];
      for (const item of validItems) {
        created.push(
          await tx.sale.create({
            data: {
              saleId,
              categoryId: item.categoryId,
              amount: item.amount,
              // The bill-level discount lives on SaleBill; rows stay gross.
              discount: 0,
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
        );
      }
      return created;
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

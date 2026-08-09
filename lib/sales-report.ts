import { parseObjectId } from "./object-id";
import { prisma } from "./prisma";
import { APP_TIME_ZONE, endOfZonedDayExclusive, isIsoDate, startOfZonedDay } from "./time-zone";

export type ReportFilters = {
  from: string | null;
  to: string | null;
  categoryId: string | null;
  salesmanId: string | null;
  saleId: string | null;
};

export type ReportRange = {
  gte?: Date;
  lt?: Date;
};

/** One sale row with its share of the bill-level discount already allocated to it. */
export type SaleLine = {
  saleId: string;
  createdAt: Date;
  categoryId: string;
  categoryNumber: number;
  categoryName: string;
  salesmanId: string | null;
  salesmanName: string;
  amount: number;
  discount: number;
};

function parseOptionalId(raw: string | null): string | null {
  return parseObjectId(raw?.trim());
}

function parseOptionalDate(raw: string | null): string | null {
  const value = raw?.trim();
  return value && isIsoDate(value) ? value : null;
}

export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  let from = parseOptionalDate(searchParams.get("from"));
  let to = parseOptionalDate(searchParams.get("to"));

  // A backwards range would silently return nothing; treat it as the range the
  // user meant rather than an empty report.
  if (from && to && from > to) {
    [from, to] = [to, from];
  }

  const saleId = searchParams.get("saleId")?.trim();

  return {
    from,
    to,
    categoryId: parseOptionalId(searchParams.get("categoryId")),
    salesmanId: parseOptionalId(searchParams.get("salesmanId")),
    saleId: saleId && saleId.length > 0 ? saleId : null,
  };
}

export function buildCreatedAtRange(
  filters: ReportFilters,
  timeZone: string = APP_TIME_ZONE,
): ReportRange | undefined {
  const range: ReportRange = {};

  if (filters.from) {
    const start = startOfZonedDay(filters.from, timeZone);
    if (start) {
      range.gte = start;
    }
  }

  if (filters.to) {
    const end = endOfZonedDayExclusive(filters.to, timeZone);
    if (end) {
      range.lt = end;
    }
  }

  return range.gte || range.lt ? range : undefined;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Splits a bill-level discount across the bill's line amounts, proportionally.
 * The last line absorbs the rounding remainder so the shares always sum back to
 * the discount exactly.
 */
export function allocateDiscount(amounts: number[], billDiscount: number): number[] {
  const gross = amounts.reduce((sum, amount) => sum + amount, 0);
  const capped = Math.min(Math.max(billDiscount, 0), gross);

  let allocated = 0;
  return amounts.map((amount, index) => {
    const share =
      gross <= 0
        ? 0
        : index === amounts.length - 1
          ? roundCurrency(capped - allocated)
          : roundCurrency((capped * amount) / gross);
    allocated += share;
    return share;
  });
}

/**
 * Loads sale rows for the given filters and spreads each bill's discount across
 * its rows in proportion to their amounts.
 *
 * Bill discounts live on `SaleBill`, not on the individual `Sale` rows, so any
 * per-category report that reads `Sale.discount` directly reports a zero discount
 * and a net that does not add up to the overall net. Allocating here — once, in a
 * place both reports share — keeps the category tab and the sale tab consistent.
 *
 * The category filter is deliberately applied *after* allocation: the whole bill is
 * needed to work out each row's share.
 */
export async function loadSaleLines(filters: ReportFilters): Promise<SaleLine[]> {
  const createdAt = buildCreatedAtRange(filters);

  const sales = await prisma.sale.findMany({
    where: {
      ...(createdAt ? { createdAt } : {}),
      ...(filters.salesmanId ? { salesmanId: filters.salesmanId } : {}),
      ...(filters.saleId ? { saleId: { contains: filters.saleId, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      saleId: true,
      amount: true,
      discount: true,
      createdAt: true,
      categoryId: true,
      category: { select: { number: true, name: true } },
      salesmanId: true,
      salesman: { select: { name: true } },
    },
  });

  if (sales.length === 0) {
    return [];
  }

  const saleIds = [...new Set(sales.map((sale) => sale.saleId))];
  const bills = await prisma.saleBill.findMany({
    where: { saleId: { in: saleIds } },
    select: { saleId: true, totalDiscount: true },
  });
  const billDiscounts = new Map(bills.map((bill) => [bill.saleId, bill.totalDiscount]));

  const rowsByBill = new Map<string, typeof sales>();
  for (const sale of sales) {
    const existing = rowsByBill.get(sale.saleId);
    if (existing) {
      existing.push(sale);
    } else {
      rowsByBill.set(sale.saleId, [sale]);
    }
  }

  const lines: SaleLine[] = [];

  for (const [saleId, rows] of rowsByBill) {
    // Sales written before SaleBill existed kept the discount on the first row.
    const legacyDiscount = rows.reduce((sum, row) => sum + row.discount, 0);
    const billDiscount = billDiscounts.get(saleId) ?? legacyDiscount;
    const shares = allocateDiscount(
      rows.map((row) => row.amount),
      billDiscount,
    );

    rows.forEach((row, index) => {
      const share = shares[index];

      lines.push({
        saleId,
        createdAt: row.createdAt,
        categoryId: row.categoryId,
        categoryNumber: row.category.number,
        categoryName: row.category.name,
        salesmanId: row.salesmanId,
        salesmanName: row.salesman?.name ?? "N/A",
        amount: row.amount,
        discount: share,
      });
    });
  }

  return filters.categoryId
    ? lines.filter((line) => line.categoryId === filters.categoryId)
    : lines;
}

export type CategoryTotals = {
  categoryId: string;
  number: number;
  name: string;
  grossAmount: number;
  totalDiscount: number;
  totalAmount: number;
  totalSales: number;
};

export function summariseByCategory(lines: SaleLine[]): Map<string, CategoryTotals> {
  const totals = new Map<string, CategoryTotals>();

  for (const line of lines) {
    const existing = totals.get(line.categoryId);
    if (!existing) {
      totals.set(line.categoryId, {
        categoryId: line.categoryId,
        number: line.categoryNumber,
        name: line.categoryName,
        grossAmount: line.amount,
        totalDiscount: line.discount,
        totalAmount: line.amount - line.discount,
        totalSales: 1,
      });
      continue;
    }

    existing.grossAmount += line.amount;
    existing.totalDiscount += line.discount;
    existing.totalAmount += line.amount - line.discount;
    existing.totalSales += 1;
  }

  for (const totalsForCategory of totals.values()) {
    totalsForCategory.grossAmount = roundCurrency(totalsForCategory.grossAmount);
    totalsForCategory.totalDiscount = roundCurrency(totalsForCategory.totalDiscount);
    totalsForCategory.totalAmount = roundCurrency(totalsForCategory.totalAmount);
  }

  return totals;
}

export type SaleTotals = {
  saleId: string;
  createdAt: Date;
  salesmanName: string;
  totalItems: number;
  grossAmount: number;
  totalDiscount: number;
  netAmount: number;
};

export function summariseBySale(lines: SaleLine[]): SaleTotals[] {
  const totals = new Map<string, SaleTotals>();

  for (const line of lines) {
    const existing = totals.get(line.saleId);
    if (!existing) {
      totals.set(line.saleId, {
        saleId: line.saleId,
        createdAt: line.createdAt,
        salesmanName: line.salesmanName,
        totalItems: 1,
        grossAmount: line.amount,
        totalDiscount: line.discount,
        netAmount: line.amount - line.discount,
      });
      continue;
    }

    if (line.createdAt > existing.createdAt) {
      existing.createdAt = line.createdAt;
    }
    existing.totalItems += 1;
    existing.grossAmount += line.amount;
    existing.totalDiscount += line.discount;
    existing.netAmount += line.amount - line.discount;
  }

  return [...totals.values()]
    .map((sale) => ({
      ...sale,
      grossAmount: roundCurrency(sale.grossAmount),
      totalDiscount: roundCurrency(sale.totalDiscount),
      netAmount: roundCurrency(sale.netAmount),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function summariseOverall(lines: SaleLine[]) {
  const grossAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const totalDiscount = lines.reduce((sum, line) => sum + line.discount, 0);

  return {
    grossAmount: roundCurrency(grossAmount),
    totalDiscount: roundCurrency(totalDiscount),
    totalAmount: roundCurrency(grossAmount - totalDiscount),
    totalSales: lines.length,
    totalBills: new Set(lines.map((line) => line.saleId)).size,
  };
}

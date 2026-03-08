import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
const databaseUrl =
  !configuredDatabaseUrl || configuredDatabaseUrl === "file:./dev.db"
    ? "file:./prisma/dev.db"
    : configuredDatabaseUrl;
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    number: 1,
    name: "Jewelry",
    imageUrl:
      "/images/jewelry.jpg",
  },
  {
    number: 2,
    name: "Jhumki",
    imageUrl:
      "/images/jhumki.jpg",
  },
  {
    number: 3,
    name: "Bangles",
    imageUrl:
      "/images/bangles.webp",
  },
  {
    number: 4,
    name: "Bangle Set",
    imageUrl:
      "/images/bangles-set.jpg",
  },
  {
    number: 5,
    name: "Accessories",
    imageUrl:
      "/images/accessories.webp",
  },
  {
    number: 6,
    name: "Makeup",
    imageUrl:
      "/images/makeup.jpeg",
  },
  {
    number: 7,
    name: "Glasses",
    imageUrl:
      "/images/glasses.webp",
  },
  {
    number: 8,
    name: "Mehndi",
    imageUrl:
      "/images/mehndi.jpg",
  },
  {
    number: 9,
    name: "Watches",
    imageUrl:
      "/images/watches.jpg",
  },
  {
    number: 10,
    name: "Baby Bags",
    imageUrl:
      "/images/baby-bag.jpg",
  },
] as const;

const salesmen = [{ name: "Ali" }, { name: "Bilal" }, { name: "Usman" }, { name: "Ahmed" }] as const;

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { number: category.number },
      update: { name: category.name, imageUrl: category.imageUrl },
      create: category,
    });
  }

  for (const salesman of salesmen) {
    await prisma.salesman.upsert({
      where: { name: salesman.name },
      update: {},
      create: salesman,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

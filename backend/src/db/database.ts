import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

export async function initializeDatabase(): Promise<void> {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("Connected to PostgreSQL");
}

export default prisma;
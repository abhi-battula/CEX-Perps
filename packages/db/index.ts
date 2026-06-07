import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(import.meta.dir, "../../.env") });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
console.log("DATABASE_URL:", process.env.DATABASE_URL);
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({connectionString:DATABASE_URL})
export const prisma = new PrismaClient({adapter})
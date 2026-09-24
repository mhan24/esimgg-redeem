/**
 * GET /api/health (规格 §56)
 */
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "error" = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "ok";
  } catch {
    database = "error";
  }
  return Response.json({
    status: database === "ok" ? "ok" : "degraded",
    database,
  });
}

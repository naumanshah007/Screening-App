import { PrismaClient } from "@prisma/client";
import { createPrismaAdapter } from "@/lib/config/database";
import { ensureDatabaseReady } from "@/lib/database/bootstrap";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma() {
  const adapter = createPrismaAdapter();
  const performanceTraceEnabled =
    process.env.CERVIGRADE_PERFORMANCE_TRACE === "1";
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const startedAt = performanceTraceEnabled ? performance.now() : 0;
          try {
            await ensureDatabaseReady();
            return await query(args);
          } finally {
            if (performanceTraceEnabled) {
              // Deliberately excludes query arguments and returned data: this is
              // safe operational timing metadata, not a second audit or data log.
              console.info(
                `[cervigrade:performance:db] ${JSON.stringify({
                  model,
                  operation,
                  durationMs: Number((performance.now() - startedAt).toFixed(2)),
                })}`
              );
            }
          }
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

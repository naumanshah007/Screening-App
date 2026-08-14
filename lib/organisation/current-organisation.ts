import { prisma } from "@/lib/prisma";

/**
 * Which organisation this deployment is operating.
 *
 * SINGLE-TENANT, DELIBERATELY
 * ---------------------------
 * A deployment serves one customer. There is no organisation on the session, no
 * organisation in the URL and no switcher, because none of those are needed yet
 * and each would be a permission surface to get wrong. What this module provides
 * is the *seam*: every write that will later need a tenant asks this one function
 * instead of assuming, so making the product multi-tenant later is a change to
 * this file and its callers rather than an archaeology exercise across the schema.
 *
 * WHY THE MODEL EXISTS BEFORE IT IS NEEDED
 * ----------------------------------------
 * Screening episodes and usage events are append-only by design. A tenant column
 * added after a pilot cannot be backfilled onto rows that may not be updated, so
 * the history generated during the pilot would be permanently unattributable.
 * Creating the model now costs one table; creating it later costs the history.
 *
 * RESOLUTION ORDER
 * ----------------
 * 1. `ORGANISATION_KEY` if set — an explicit choice, and a missing organisation
 *    is an error rather than a silent fallback to whatever else is in the table.
 * 2. Otherwise the single active organisation, when there is exactly one.
 *
 * Both zero and more-than-one are errors. Guessing when the answer is ambiguous
 * is how rows end up attributed to the wrong customer, and the moment a second
 * organisation appears this surfaces it instead of silently picking the older row.
 */

/** Key for the organisation seeded into a fresh single-tenant deployment. */
export const DEFAULT_ORGANISATION_KEY = "counties-manukau";
export const DEFAULT_ORGANISATION_NAME = "Health NZ — Counties Manukau";
export const DEFAULT_ORGANISATION_SHORT_NAME = "Counties Manukau";

export type CurrentOrganisation = {
  id: string;
  key: string;
  name: string;
  shortName: string | null;
};

const SELECT = { id: true, key: true, name: true, shortName: true } as const;

/** The configured key, or null when the deployment has not named one. */
export function getConfiguredOrganisationKey(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const raw = env.ORGANISATION_KEY?.trim();
  return raw ? raw : null;
}

/**
 * Resolve the operating organisation, or null when none can be determined.
 *
 * Returns null rather than throwing so read paths (dashboards, reports) can
 * render an honest empty state on a database that has not been seeded yet.
 * Write paths must use `requireCurrentOrganisationId` instead.
 */
export async function getCurrentOrganisation(): Promise<CurrentOrganisation | null> {
  const configuredKey = getConfiguredOrganisationKey();

  if (configuredKey) {
    return prisma.organisation.findFirst({
      where: { key: configuredKey, isActive: true },
      select: SELECT,
    });
  }

  // Take two so "exactly one" can be distinguished from "more than one".
  const active = await prisma.organisation.findMany({
    where: { isActive: true },
    select: SELECT,
    orderBy: { createdAt: "asc" },
    take: 2,
  });

  return active.length === 1 ? active[0] : null;
}

/**
 * The operating organisation, or a failure that says what to fix.
 *
 * Use this on every write path. Failing closed is correct here: a run, episode
 * or usage event written without a tenant is worse than one not written at all,
 * because the first is silently wrong and the second is visibly broken.
 */
export async function requireCurrentOrganisation(): Promise<CurrentOrganisation> {
  const organisation = await getCurrentOrganisation();
  if (organisation) return organisation;

  const configuredKey = getConfiguredOrganisationKey();
  if (configuredKey) {
    throw new Error(
      `No active organisation with key "${configuredKey}". ORGANISATION_KEY names an organisation that does not exist or is disabled.`
    );
  }

  const count = await prisma.organisation.count({ where: { isActive: true } });
  throw new Error(
    count === 0
      ? "No active organisation exists. Seed one before processing cases."
      : `${count} active organisations exist and none is selected. Set ORGANISATION_KEY to name the one this deployment operates.`
  );
}

/** Convenience for the common case: the id to stamp on a new row. */
export async function requireCurrentOrganisationId(): Promise<string> {
  return (await requireCurrentOrganisation()).id;
}

/**
 * Create the single-tenant organisation if it is absent.
 *
 * Idempotent, and deliberately never updates an existing row: the name is
 * customer-editable data, and re-running a bootstrap must not overwrite what
 * someone has corrected.
 */
export async function ensureDefaultOrganisation(args: {
  key?: string;
  name?: string;
  shortName?: string | null;
} = {}): Promise<CurrentOrganisation> {
  const key = args.key ?? getConfiguredOrganisationKey() ?? DEFAULT_ORGANISATION_KEY;

  const existing = await prisma.organisation.findUnique({
    where: { key },
    select: SELECT,
  });
  if (existing) return existing;

  return prisma.organisation.create({
    data: {
      key,
      name: args.name ?? DEFAULT_ORGANISATION_NAME,
      shortName:
        args.shortName === undefined ? DEFAULT_ORGANISATION_SHORT_NAME : args.shortName,
    },
    select: SELECT,
  });
}

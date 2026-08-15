export const APP_TIME_ZONE = "Pacific/Auckland";

export function formatAppDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatAppDate(value: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export const USAGE_RANGE_PRESETS = [
  "today",
  "7d",
  "30d",
  "month",
  "custom",
] as const;

export type UsageRangePreset = (typeof USAGE_RANGE_PRESETS)[number];

export type UsageDateRange = {
  preset: UsageRangePreset;
  from: Date;
  toExclusive: Date;
  fromDate: string;
  toDate: string;
  label: string;
};

const DAY_MS = 86_400_000;

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function dateKey(parts: { year: number; month: number; day: number }) {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function parseDateKey(value: string | undefined): {
  year: number;
  month: number;
  day: number;
} | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function moveDateKey(value: string, days: number) {
  const parsed = parseDateKey(value);
  if (!parsed) throw new Error(`Invalid date key: ${value}`);
  const moved = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day) + days * DAY_MS
  );
  return dateKey({
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  });
}

/** Convert a calendar midnight in the app timezone into an exact UTC instant. */
export function startOfAppDay(value: string): Date {
  const parsed = parseDateKey(value);
  if (!parsed) throw new Error(`Invalid app date: ${value}`);

  const desiredUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  let candidate = new Date(desiredUtc);

  // Two passes cover offset/DST changes without a timezone dependency. The
  // second pass validates the offset at the corrected instant.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const shown = localParts(candidate);
    const shownAsUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second
    );
    candidate = new Date(candidate.getTime() + desiredUtc - shownAsUtc);
  }
  return candidate;
}

export function resolveUsageDateRange(
  input: { preset?: string; from?: string; to?: string },
  now = new Date()
): UsageDateRange {
  const today = dateKey(localParts(now));
  const requested = USAGE_RANGE_PRESETS.includes(input.preset as UsageRangePreset)
    ? (input.preset as UsageRangePreset)
    : "30d";

  let preset = requested;
  let fromDate: string;
  let toDate: string;

  if (requested === "custom") {
    const customFrom = parseDateKey(input.from);
    const customTo = parseDateKey(input.to);
    if (customFrom && customTo && input.from! <= input.to!) {
      fromDate = input.from!;
      toDate = input.to!;
    } else {
      preset = "30d";
      fromDate = moveDateKey(today, -29);
      toDate = today;
    }
  } else if (requested === "today") {
    fromDate = today;
    toDate = today;
  } else if (requested === "7d") {
    fromDate = moveDateKey(today, -6);
    toDate = today;
  } else if (requested === "month") {
    fromDate = `${today.slice(0, 7)}-01`;
    toDate = today;
  } else {
    fromDate = moveDateKey(today, -29);
    toDate = today;
  }

  const from = startOfAppDay(fromDate);
  const toExclusive = startOfAppDay(moveDateKey(toDate, 1));
  const label =
    fromDate === toDate
      ? new Intl.DateTimeFormat("en-NZ", {
          timeZone: APP_TIME_ZONE,
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(from)
      : `${new Intl.DateTimeFormat("en-NZ", {
          timeZone: APP_TIME_ZONE,
          day: "numeric",
          month: "short",
        }).format(from)} – ${new Intl.DateTimeFormat("en-NZ", {
          timeZone: APP_TIME_ZONE,
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(toExclusive.getTime() - 1))}`;

  return { preset, from, toExclusive, fromDate, toDate, label };
}

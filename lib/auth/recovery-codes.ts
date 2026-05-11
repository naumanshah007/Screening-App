import { createHash, randomBytes } from "node:crypto";

export const RECOVERY_CODE_COUNT = 8;

function normalizeRecoveryCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashRecoveryCode(code: string) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

function formatRecoveryCode(raw: string) {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function createRecoveryCodes() {
  const rawCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    formatRecoveryCode(randomBytes(4).toString("hex").toUpperCase())
  );

  return {
    rawCodes,
    storedJson: JSON.stringify(rawCodes.map((code) => hashRecoveryCode(code))),
  };
}

export function countRecoveryCodes(storedJson?: string | null) {
  if (!storedJson) {
    return 0;
  }

  try {
    const parsed = JSON.parse(storedJson) as string[];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function consumeRecoveryCode(args: {
  storedJson?: string | null;
  code: string;
}) {
  if (!args.storedJson) {
    return {
      valid: false,
      nextStoredJson: args.storedJson ?? null,
      remainingCount: 0,
    };
  }

  try {
    const parsed = JSON.parse(args.storedJson) as string[];
    if (!Array.isArray(parsed)) {
      return {
        valid: false,
        nextStoredJson: args.storedJson,
        remainingCount: 0,
      };
    }

    const hashedCode = hashRecoveryCode(args.code);
    const matchIndex = parsed.findIndex((entry) => entry === hashedCode);
    if (matchIndex === -1) {
      return {
        valid: false,
        nextStoredJson: args.storedJson,
        remainingCount: parsed.length,
      };
    }

    const remaining = parsed.filter((_, index) => index !== matchIndex);
    return {
      valid: true,
      nextStoredJson: remaining.length > 0 ? JSON.stringify(remaining) : null,
      remainingCount: remaining.length,
    };
  } catch {
    return {
      valid: false,
      nextStoredJson: args.storedJson,
      remainingCount: 0,
    };
  }
}

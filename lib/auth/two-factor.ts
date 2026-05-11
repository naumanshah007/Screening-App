import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

const TWO_FACTOR_ISSUER =
  process.env.TWO_FACTOR_ISSUER ?? "Health NZ Women's Health";

export function normalizeTwoFactorCode(code: string) {
  return code.replace(/\s+/g, "").replace(/-/g, "");
}

export function verifyTwoFactorCode(secret: string, code: string) {
  const result = verifySync({
    strategy: "totp",
    token: normalizeTwoFactorCode(code),
    secret,
    epochTolerance: 1,
  });

  return typeof result === "boolean" ? result : result.valid === true;
}

export function generateTwoFactorSecret(label: string) {
  const secret = generateSecret();
  const otpauthUrl = buildTwoFactorOtpauthUrl(label, secret);

  return {
    secret,
    otpauthUrl,
  };
}

export function buildTwoFactorOtpauthUrl(label: string, secret: string) {
  return generateURI({
    strategy: "totp",
    issuer: TWO_FACTOR_ISSUER,
    label,
    secret,
    digits: 6,
    period: 30,
    algorithm: "sha1",
  });
}

export async function generateTwoFactorQrDataUrl(otpauthUrl: string) {
  return QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
  });
}

export function formatManualEntryKey(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export type SecretReferenceDescription = {
  configured: boolean;
  provider: string | null;
  label: string;
};

export type ResolvedSecret = {
  /** Server-only opaque material. Never serialize this object. */
  value: string;
  provider: "environment";
};

export class SecretResolutionError extends Error {
  readonly code = "SECRET_REFERENCE_UNRESOLVED";

  constructor() {
    super("Configured reference could not be resolved");
    this.name = "SecretResolutionError";
  }
}

/** Provider-neutral server seam. Callers must never serialize resolved values. */
export interface SecretProvider {
  describe(ref: string | null): Promise<SecretReferenceDescription>;
  resolve(ref: string): Promise<ResolvedSecret>;
}

const ENV_REFERENCE = /^env:([A-Z][A-Z0-9_]{1,127})$/;
const MAX_SECRET_BYTES = 32 * 1024;

function safeProviderLabel(ref: string) {
  const prefix = ref.split(":", 1)[0];
  if (prefix === "env") return "Environment variable";
  if (prefix === "vault") return "Vault";
  if (prefix === "keyvault") return "Key Vault";
  if (prefix === "aws-secrets") return "AWS Secrets Manager";
  if (prefix === "secret") return "Secret provider";
  return "Unknown provider";
}

/** Initial provider implementation: Vercel/server environment references only. */
export function createEnvironmentSecretProvider(
  environment: NodeJS.ProcessEnv = process.env
): SecretProvider {
  return {
    async describe(ref) {
      if (!ref) {
        return { configured: false, provider: null, label: "Credential reference missing" };
      }
      return {
        configured: true,
        provider: safeProviderLabel(ref),
        label: "Credential reference configured",
      };
    },
    async resolve(ref) {
      const match = ENV_REFERENCE.exec(ref);
      if (!match) throw new SecretResolutionError();
      const value = environment[match[1]!];
      if (!value || Buffer.byteLength(value, "utf8") > MAX_SECRET_BYTES) {
        throw new SecretResolutionError();
      }
      return { value, provider: "environment" };
    },
  };
}

export const serverSecretProvider = createEnvironmentSecretProvider();

/** Configuration validation deliberately describes references without resolve. */
export const metadataOnlySecretProvider = serverSecretProvider;

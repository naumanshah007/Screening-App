export type SecretReferenceDescription = {
  configured: boolean;
  provider: string | null;
  label: string;
};

/** Provider-neutral seam for later connectivity phases. */
export interface SecretProvider {
  describe(ref: string | null): Promise<SecretReferenceDescription>;
  resolve(ref: string): Promise<never>;
}

/**
 * Phase 3A only describes references. It cannot resolve a credential and has no
 * network/provider client, preventing validation from accidentally becoming a
 * connectivity or secret-retrieval operation.
 */
export const metadataOnlySecretProvider: SecretProvider = {
  async describe(ref) {
    if (!ref) {
      return { configured: false, provider: null, label: "Credential reference missing" };
    }
    return {
      configured: true,
      provider: ref.split(":", 1)[0] ?? null,
      label: "Credential reference configured",
    };
  },
  async resolve() {
    throw new Error("Secret resolution is unavailable in configuration-only Phase 3A");
  },
};

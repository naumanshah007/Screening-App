/**
 * Document storage abstraction layer.
 *
 * Provides a provider-agnostic interface for storing and retrieving referral
 * documents. Concrete implementations must satisfy NZ data sovereignty
 * requirements — all storage must remain within NZ-hosted infrastructure.
 *
 * Supported backends (configured via DOCUMENT_STORAGE_PROVIDER env var):
 *   "local"   — local filesystem (development only)
 *   "azure"   — Azure Blob Storage, NZ North region
 *   "s3-nz"   — S3-compatible NZ-hosted object store (future)
 */

import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "fs";
import { unlink, stat } from "fs/promises";
import { join } from "path";
import { Readable } from "stream";

export type StorageUploadArgs = {
  key: string;
  contentType: string;
  byteSize: number;
  stream: Readable;
};

export type StorageUploadResult =
  | { ok: true; storageKey: string; byteSize: number }
  | { ok: false; error: string };

export type StorageDownloadResult =
  | { ok: true; stream: Readable; contentType: string; byteSize: number }
  | { ok: false; error: string; code: "NOT_FOUND" | "UNAVAILABLE" };

export type StorageDeleteResult =
  | { ok: true }
  | { ok: false; error: string };

export interface DocumentStorageProvider {
  upload(args: StorageUploadArgs): Promise<StorageUploadResult>;
  download(storageKey: string): Promise<StorageDownloadResult>;
  delete(storageKey: string): Promise<StorageDeleteResult>;
  presignedUrl(storageKey: string, expiresInSeconds?: number): Promise<string | null>;
  readonly providerName: string;
}

export type DocumentStorageRuntimeSummary = {
  providerName: string;
  configured: boolean;
  implementation: "development" | "live" | "stub";
  targetLabel: string;
  supportsPresignedUrls: boolean;
};

export type DocumentStorageHealthCheck = {
  status: "ready" | "warning" | "blocked" | "info";
  summary: string;
  detail: string;
};

const DEFAULT_AZURE_CONTAINER = "referral-documents";

type AzureStorageConfig = {
  connectionString: string;
  containerName: string;
  accountName?: string;
  accountKey?: string;
};

function getLocalStorageDir() {
  return (
    normalizeEnvValue(process.env.LOCAL_STORAGE_DIR) ??
    join("storage", "referral-documents")
  );
}

function normalizeEnvValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseAzureConnectionString(connectionString: string) {
  const entries = connectionString
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return [part, ""];
      }

      return [
        part.slice(0, separatorIndex).trim(),
        part.slice(separatorIndex + 1).trim(),
      ];
    });

  return Object.fromEntries(entries);
}

function getAzureStorageConfig(): AzureStorageConfig | null {
  const connectionString = normalizeEnvValue(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );

  if (!connectionString) {
    return null;
  }

  const parsed = parseAzureConnectionString(connectionString);

  return {
    connectionString,
    containerName:
      normalizeEnvValue(process.env.AZURE_STORAGE_CONTAINER_NAME) ??
      DEFAULT_AZURE_CONTAINER,
    accountName: normalizeEnvValue(parsed.AccountName),
    accountKey: normalizeEnvValue(parsed.AccountKey),
  };
}

export function getDocumentStorageRuntimeSummary(): DocumentStorageRuntimeSummary {
  const provider = (process.env.DOCUMENT_STORAGE_PROVIDER ?? "local").trim().toLowerCase();

  if (provider === "azure" || provider === "azure-nz-north") {
    const config = getAzureStorageConfig();

    return {
      providerName: "azure-nz-north",
      configured: Boolean(config),
      implementation: config ? "live" : "stub",
      targetLabel: config
        ? `${config.accountName ?? "azure-account"}/${config.containerName}`
        : DEFAULT_AZURE_CONTAINER,
      supportsPresignedUrls: Boolean(config?.accountName && config?.accountKey),
    };
  }

  return {
    providerName: "local",
    configured: true,
      implementation: "development",
      targetLabel: getLocalStorageDir(),
      supportsPresignedUrls: false,
    };
  }

export async function getDocumentStorageHealthCheck(): Promise<DocumentStorageHealthCheck> {
  const runtime = getDocumentStorageRuntimeSummary();

  if (runtime.implementation === "development") {
    return {
      status: "warning",
      summary: "Document storage is using the local filesystem provider.",
      detail:
        "This is suitable for development and demos, but not for enterprise deployment.",
    };
  }

  if (!runtime.configured) {
    return {
      status: "blocked",
      summary: "Document storage provider is selected but not configured.",
      detail:
        "The runtime is missing the provider settings required for enterprise document storage.",
    };
  }

  if (runtime.providerName === "azure-nz-north") {
    const config = getAzureStorageConfig();
    if (!config) {
      return {
        status: "blocked",
        summary: "Azure Blob Storage is selected but configuration is incomplete.",
        detail:
          "AZURE_STORAGE_CONNECTION_STRING is required before document storage can be validated.",
      };
    }

    try {
      const serviceClient = BlobServiceClient.fromConnectionString(
        config.connectionString
      );
      const containerClient = serviceClient.getContainerClient(config.containerName);
      const exists = await containerClient.exists();

      if (!exists) {
        return {
          status: "warning",
          summary: "Azure Blob Storage is reachable, but the container does not exist yet.",
          detail:
            `Container ${config.containerName} has not been created. Uploads can create it automatically, but enterprise deployment should validate container policy and access first.`,
        };
      }

      const properties = await containerClient.getProperties();
      return {
        status: "ready",
        summary: "Azure Blob Storage is reachable and responding.",
        detail: `Container ${config.containerName} is accessible. Last modified ${properties.lastModified?.toISOString() ?? "unknown"}.`,
      };
    } catch (error) {
      return {
        status: "blocked",
        summary: "Azure Blob Storage validation failed.",
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    status: "info",
    summary: `Storage provider ${runtime.providerName} is selected.`,
    detail:
      "No provider-specific live validation is implemented for this storage backend yet.",
  };
}

class LocalStorageProvider implements DocumentStorageProvider {
  readonly providerName = "local";

  private ensureDir() {
    const localStorageDir = getLocalStorageDir();
    if (!existsSync(localStorageDir)) {
      mkdirSync(localStorageDir, { recursive: true });
    }
  }

  private fullPath(key: string) {
    const safe = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return join(getLocalStorageDir(), safe);
  }

  async upload(args: StorageUploadArgs): Promise<StorageUploadResult> {
    try {
      this.ensureDir();
      const path = this.fullPath(args.key);
      const dir = path.substring(0, path.lastIndexOf("/"));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      await new Promise<void>((resolve, reject) => {
        const ws = createWriteStream(path);
        args.stream.pipe(ws);
        ws.on("finish", resolve);
        ws.on("error", reject);
        args.stream.on("error", reject);
      });

      const { size } = await stat(path);
      return { ok: true, storageKey: args.key, byteSize: size };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async download(storageKey: string): Promise<StorageDownloadResult> {
    const path = this.fullPath(storageKey);
    if (!existsSync(path)) {
      return { ok: false, error: "File not found", code: "NOT_FOUND" };
    }

    try {
      const { size } = await stat(path);
      const stream = createReadStream(path);
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      const contentType =
        ext === "pdf"
          ? "application/pdf"
          : ext === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "png"
                ? "image/png"
                : "application/octet-stream";
      return { ok: true, stream, contentType, byteSize: size };
    } catch (err) {
      return { ok: false, error: String(err), code: "UNAVAILABLE" };
    }
  }

  async delete(storageKey: string): Promise<StorageDeleteResult> {
    const path = this.fullPath(storageKey);
    try {
      await unlink(path);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async presignedUrl(): Promise<string | null> {
    return null;
  }
}

class AzureBlobStorageProvider implements DocumentStorageProvider {
  readonly providerName = "azure-nz-north";

  private get config() {
    return getAzureStorageConfig();
  }

  private get containerName() {
    return this.config?.containerName ?? DEFAULT_AZURE_CONTAINER;
  }

  private getServiceClient() {
    const config = this.config;
    if (!config) {
      return null;
    }

    return BlobServiceClient.fromConnectionString(config.connectionString);
  }

  private getContainerClient() {
    const serviceClient = this.getServiceClient();
    if (!serviceClient) {
      return null;
    }

    return serviceClient.getContainerClient(this.containerName);
  }

  async upload(args: StorageUploadArgs): Promise<StorageUploadResult> {
    const containerClient = this.getContainerClient();
    if (!containerClient) {
      return {
        ok: false,
        error:
          "Azure storage is selected but AZURE_STORAGE_CONNECTION_STRING is not configured.",
      };
    }

    try {
      await containerClient.createIfNotExists();
      const blobClient = containerClient.getBlockBlobClient(args.key);
      await blobClient.uploadStream(args.stream, 4 * 1024 * 1024, 5, {
        blobHTTPHeaders: {
          blobContentType: args.contentType,
        },
      });

      return {
        ok: true,
        storageKey: args.key,
        byteSize: args.byteSize,
      };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async download(storageKey: string): Promise<StorageDownloadResult> {
    const containerClient = this.getContainerClient();
    if (!containerClient) {
      return {
        ok: false,
        error:
          "Azure storage is selected but AZURE_STORAGE_CONNECTION_STRING is not configured.",
        code: "UNAVAILABLE",
      };
    }

    try {
      const blobClient = containerClient.getBlobClient(storageKey);
      const exists = await blobClient.exists();

      if (!exists) {
        return { ok: false, error: "File not found", code: "NOT_FOUND" };
      }

      const response = await blobClient.download();
      if (!response.readableStreamBody) {
        return {
          ok: false,
          error: "Azure returned an empty blob stream.",
          code: "UNAVAILABLE",
        };
      }

      return {
        ok: true,
        stream: response.readableStreamBody as Readable,
        contentType:
          response.contentType ?? "application/octet-stream",
        byteSize: response.contentLength ?? 0,
      };
    } catch (err) {
      return { ok: false, error: String(err), code: "UNAVAILABLE" };
    }
  }

  async delete(storageKey: string): Promise<StorageDeleteResult> {
    const containerClient = this.getContainerClient();
    if (!containerClient) {
      return {
        ok: false,
        error:
          "Azure storage is selected but AZURE_STORAGE_CONNECTION_STRING is not configured.",
      };
    }

    try {
      await containerClient.deleteBlob(storageKey, {
        deleteSnapshots: "include",
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async presignedUrl(
    storageKey: string,
    expiresInSeconds = 300
  ): Promise<string | null> {
    const config = this.config;
    const containerClient = this.getContainerClient();

    if (
      !config ||
      !containerClient ||
      !config.accountName ||
      !config.accountKey
    ) {
      return null;
    }

    const blobClient = containerClient.getBlobClient(storageKey);
    const credential = new StorageSharedKeyCredential(
      config.accountName,
      config.accountKey
    );
    const sas = generateBlobSASQueryParameters(
      {
        containerName: config.containerName,
        blobName: storageKey,
        permissions: BlobSASPermissions.parse("r"),
        startsOn: new Date(Date.now() - 60_000),
        expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
      },
      credential
    ).toString();

    return `${blobClient.url}?${sas}`;
  }
}

function createStorageProvider(): DocumentStorageProvider {
  const provider = (process.env.DOCUMENT_STORAGE_PROVIDER ?? "local")
    .trim()
    .toLowerCase();

  switch (provider) {
    case "azure":
    case "azure-nz-north":
      return new AzureBlobStorageProvider();
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

export const documentStorage: DocumentStorageProvider = createStorageProvider();

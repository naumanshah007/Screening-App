/**
 * Batch Processing — Adapter Registry
 *
 * Central registry for all data source adapters.
 * Detects file type and returns the appropriate adapter.
 */

import type { DataSourceAdapter, SourceType } from "../types";
import { DemoDatasetAdapter } from "./demo-adapter";
import { CSVUploadAdapter } from "./csv-adapter";
import { ExcelUploadAdapter } from "./xlsx-adapter";
import { JSONUploadAdapter } from "./json-adapter";

// ─── Adapter Registry ────────────────────────────────────────────────────────

const adapters: DataSourceAdapter[] = [
  new DemoDatasetAdapter(),
  new CSVUploadAdapter(),
  new ExcelUploadAdapter(),
  new JSONUploadAdapter(),
];

/**
 * Detect file type from filename extension.
 */
export function detectFileType(fileName: string): SourceType | null {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "csv":
      return "csv";
    case "xlsx":
    case "xls":
      return "xlsx";
    case "json":
      return "json";
    default:
      return null;
  }
}

/**
 * Get an adapter by source type.
 */
export function getAdapter(sourceType: SourceType): DataSourceAdapter | null {
  return adapters.find((a) => a.sourceType === sourceType) ?? null;
}

/**
 * Get an adapter for a given filename.
 */
export function getAdapterForFile(fileName: string): DataSourceAdapter | null {
  const sourceType = detectFileType(fileName);
  if (!sourceType) return null;
  return getAdapter(sourceType);
}

/**
 * Register a new adapter (used for dynamic adapter registration in Phase 4+).
 */
export function registerAdapter(adapter: DataSourceAdapter): void {
  // Remove existing adapter for same sourceType
  const idx = adapters.findIndex((a) => a.sourceType === adapter.sourceType);
  if (idx >= 0) adapters.splice(idx, 1);
  adapters.push(adapter);
}

export { DemoDatasetAdapter, CSVUploadAdapter, ExcelUploadAdapter, JSONUploadAdapter };

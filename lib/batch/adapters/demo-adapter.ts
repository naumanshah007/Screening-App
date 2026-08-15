/**
 * Batch Processing — Demo Dataset Adapter
 *
 * Returns the built-in demo dataset as ParsedSourceRow[].
 * This adapter is used when the user clicks "Try Demo Dataset".
 */

import type { DataSourceAdapter, AdapterParseResult, ParsedSourceRow } from "../types";
import { DEMO_DATASET } from "../demo-dataset";
import { BATCH_COLUMNS } from "../template-columns";

export class DemoDatasetAdapter implements DataSourceAdapter<void> {
  readonly name = "Built-in Demo Dataset";
  readonly sourceType = "demo" as const;

  async parse(): Promise<AdapterParseResult> {
    const allFields = BATCH_COLUMNS.map((c) => c.field);

    const rows: ParsedSourceRow[] = DEMO_DATASET.map((demoCase, index) => {
      // Convert CanonicalBatchCase back to flat ParsedSourceRow
      // (the demo cases are already validated, but the adapter interface
      //  requires returning ParsedSourceRow[] for consistency)
      const row: ParsedSourceRow = {
        _rowIndex: index,
        _sourceFields: allFields,
      };

      // Copy all canonical fields
      for (const col of BATCH_COLUMNS) {
        const value = (demoCase as unknown as Record<string, unknown>)[col.field];
        if (value !== undefined && value !== null) {
          row[col.field] = value;
        }
      }

      // Also copy identity fields
      row.label = demoCase.label;
      row.externalPatientId = demoCase.source.externalPatientId;

      return row;
    });

    return {
      sourceRecordCount: rows.length,
      rows,
      warnings: [],
      errors: [],
      detectedColumns: allFields,
      unmappedColumns: [],
    };
  }
}

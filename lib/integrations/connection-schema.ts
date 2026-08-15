import { z } from "zod";

import { AUTH_METHODS, CONNECTOR_TYPES } from "@/lib/integrations/connection-catalogue";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const secretReferenceSchema = z
  .string()
  .trim()
  .min(6, "Use a provider reference such as vault:integrations/example")
  .max(240)
  .regex(
    /^(vault|secret|env|keyvault|aws-secrets):[A-Za-z0-9][A-Za-z0-9/_.:-]+$/,
    "Use a provider reference, not a credential value"
  );

export const endpointMetadataSchema = z
  .object({
    baseUrl: optionalText(500),
    host: optionalText(255),
    port: z.number().int().min(1).max(65535).optional(),
    tlsMode: optionalText(40),
    sendingApplication: optionalText(120),
    sendingFacility: optionalText(120),
    receivingApplication: optionalText(120),
    receivingFacility: optionalText(120),
    acceptedMessageTypes: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    duplicateIdentityStrategy: optionalText(120),
    resourceTypes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    identifierSystem: optionalText(500),
    pagingStrategy: optionalText(160),
    incrementalParameters: optionalText(500),
    organisationSite: optionalText(160),
    facilityOrganisationId: optionalText(160),
    permittedOperations: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    screeningHistoryDepth: optionalText(80),
    programmeIdentifier: optionalText(160),
    agreementReference: optionalText(200),
    nhiLookupEnabled: z.boolean().optional(),
    lookupStrategy: optionalText(160),
  })
  .strict();

export const mappingMetadataSchema = z.record(
  z.string().trim().min(1).max(80),
  z.string().trim().max(300)
);

export const scheduleMetadataSchema = z
  .object({
    cadence: z
      .enum([
        "MANUAL",
        "GATEWAY_MANAGED",
        "EVERY_15_MINUTES",
        "HOURLY",
        "DAILY",
        "WEEKLY",
        "ON_DEMAND",
      ])
      .optional(),
    timeOfDay: optionalText(5),
    weekday: z.number().int().min(0).max(6).optional(),
    incrementalField: optionalText(160),
    searchParameters: optionalText(500),
    lookupStrategy: optionalText(160),
  })
  .strict();

export const integrationConnectionInputSchema = z
  .object({
    connectorType: z.enum(CONNECTOR_TYPES),
    name: z.string().trim().min(3).max(120),
    description: nullableText(500),
    sourceSystem: z.string().trim().min(2).max(160),
    sourceFacility: nullableText(160),
    environment: z.enum(["DEMO", "TEST", "PRODUCTION_LIKE"]),
    endpoint: endpointMetadataSchema,
    authMethod: z.enum(AUTH_METHODS),
    credentialRef: secretReferenceSchema.nullable().optional(),
    certificateRef: secretReferenceSchema.nullable().optional(),
    mappingVersion: nullableText(80),
    mapping: mappingMetadataSchema,
    schedule: scheduleMetadataSchema,
    timezone: z.string().trim().min(1).max(100),
  })
  .strict();

export const integrationConnectionUpdateSchema = integrationConnectionInputSchema.partial().strict();

export const integrationConnectionStateActionSchema = z
  .object({ action: z.enum(["PAUSE", "RESUME", "ARCHIVE"]) })
  .strict();

export type IntegrationConnectionInput = z.infer<typeof integrationConnectionInputSchema>;
export type IntegrationConnectionUpdate = z.infer<typeof integrationConnectionUpdateSchema>;
export type EndpointMetadata = z.infer<typeof endpointMetadataSchema>;
export type MappingMetadata = z.infer<typeof mappingMetadataSchema>;
export type ScheduleMetadata = z.infer<typeof scheduleMetadataSchema>;

export function parseStoredJson<T>(
  value: string,
  schema: z.ZodType<T>,
  fallback: T
): T {
  try {
    const result = schema.safeParse(JSON.parse(value));
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

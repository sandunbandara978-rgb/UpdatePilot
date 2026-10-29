import { z } from 'zod';

// Strict regex pattern for safe package IDs (WinGet, reverse-domain, MSIX, and GUID format)
export const SAFE_PACKAGE_ID_REGEX = /^[A-Za-z0-9_\-\.\+\\/\{\}]+$/;

export const PairingCodeGenerateSchema = z.object({
  deviceId: z.string().optional(),
});

export const AgentPairRequestSchema = z.object({
  pairingCode: z.string().min(6).max(20).trim(),
  deviceName: z.string().min(1).max(100).trim(),
  osVersion: z.string().min(1).max(100),
  osBuild: z.string().max(100).optional(),
  agentVersion: z.string().min(1).max(50),
});

export const AgentHeartbeatSchema = z.object({
  osVersion: z.string().optional(),
  agentVersion: z.string().optional(),
  status: z.enum(['ONLINE', 'OFFLINE']).default('ONLINE'),
});

export const DiscoveredAppSchema = z.object({
  name: z.string().min(1).max(255),
  packageId: z.string().regex(SAFE_PACKAGE_ID_REGEX).nullable().optional(),
  publisher: z.string().max(255).nullable().optional(),
  installedVersion: z.string().max(100),
  availableVersion: z.string().max(100).nullable().optional(),
  source: z.string().max(100).nullable().optional(),
});

export const ScanSubmitPayloadSchema = z.object({
  scanJobId: z.string().min(1),
  applications: z.array(DiscoveredAppSchema),
});

export const UpdatePreviewRequestSchema = z.object({
  applicationId: z.string().min(1),
});

export const UpdateExecuteRequestSchema = z.object({
  confirmed: z.literal(true),
  acknowledgedTargetVersion: z.string().min(1).optional(),
});

export const BatchUpdateExecuteSchema = z
  .object({
    confirmed: z.literal(true),
    applicationIds: z.array(z.string().min(1)).optional(),
    items: z
      .array(
        z.object({
          applicationId: z.string().min(1),
          targetVersion: z.string().min(1),
        })
      )
      .optional(),
    deviceId: z.string().optional(),
  })
  .refine(
    (data) => (data.items && data.items.length > 0) || (data.applicationIds && data.applicationIds.length > 0),
    {
      message: 'At least one application must be selected and confirmed for update.',
    }
  );

export const AgentJobReportSchema = z.object({
  status: z.enum(['RUNNING', 'VERIFYING', 'COMPLETED', 'FAILED', 'RESTART_REQUIRED']),
  exitCode: z.number().int().optional(),
  logs: z.string().max(100000).optional(),
  verifiedVersion: z.string().max(100).optional(),
  errorDetails: z.string().max(2000).optional(),
});

export const InventoryQuerySchema = z.object({
  deviceId: z.string().optional(),
  search: z.string().max(100).optional(),
  status: z.enum(['UP_TO_DATE', 'UPDATE_AVAILABLE', 'UNKNOWN_VERSION', 'UNSUPPORTED', 'UNMATCHED', 'ALL']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'publisher', 'installedVersion', 'status', 'lastScannedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

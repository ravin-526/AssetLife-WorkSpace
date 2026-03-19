import { Asset } from "../services/gmail";

export type AssetStatus = "active" | "expired" | "dueSoon" | "inactive";
export type AssetFilter = AssetStatus | "all";

/**
 * Parse warranty object with multiple key variations
 */
function parseWarrantyObject(warranty: unknown): Record<string, unknown> | null {
  if (!warranty) return null;

  if (typeof warranty === "string") {
    try {
      return JSON.parse(warranty);
    } catch {
      return null;
    }
  }

  if (typeof warranty === "object" && warranty !== null) {
    return warranty as Record<string, unknown>;
  }

  return null;
}

/**
 * Parse insurance object with multiple key variations
 */
function parseInsuranceObject(insurance: unknown): Record<string, unknown> | null {
  if (!insurance) return null;

  if (typeof insurance === "string") {
    try {
      return JSON.parse(insurance);
    } catch {
      return null;
    }
  }

  if (typeof insurance === "object" && insurance !== null) {
    return insurance as Record<string, unknown>;
  }

  return null;
}

/**
 * Parse service object with multiple key variations
 */
function parseServiceObject(service: unknown): Record<string, unknown> | null {
  if (!service) return null;

  if (typeof service === "string") {
    try {
      return JSON.parse(service);
    } catch {
      return null;
    }
  }

  if (typeof service === "object" && service !== null) {
    return service as Record<string, unknown>;
  }

  return null;
}

/**
 * Safe date parsing from unknown value
 */
function safeParseDate(value: unknown): Date | null {
  if (!value) return null;

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes"].includes(normalized)) return true;
    if (["0", "false", "no"].includes(normalized)) return false;
  }
  return null;
}

/**
 * Extract warranty end date from asset
 */
export function getWarrantyEndDate(asset: Asset): Date | null {
  const warranty = parseWarrantyObject((asset as Record<string, unknown>).warranty);
  if (!warranty) return null;

  const available = toOptionalBoolean(warranty.available);
  if (!available) return null;

  const endDateValue =
    (warranty.end_date ?? warranty.endDate ?? warranty.expiry_date ?? warranty.expiryDate) as string | undefined;

  return safeParseDate(endDateValue);
}

/**
 * Extract insurance end date from asset
 */
export function getInsuranceEndDate(asset: Asset): Date | null {
  const insurance = parseInsuranceObject((asset as Record<string, unknown>).insurance);
  if (!insurance) return null;

  const available = toOptionalBoolean(insurance.available);
  if (!available) return null;

  const endDateValue =
    (insurance.end_date ?? insurance.endDate ?? insurance.expiry_date ?? insurance.expiryDate) as
      | string
      | undefined;

  return safeParseDate(endDateValue);
}

/**
 * Extract service next due date from asset
 */
export function getServiceDueDate(asset: Asset): Date | null {
  const service = parseServiceObject((asset as Record<string, unknown>).service);
  if (!service) return null;

  const required = toOptionalBoolean(service.required ?? service.available);
  if (!required) return null;

  const dueDateValue =
    (service.next_service_date ?? service.nextServiceDate ?? service.next_due_date ?? service.nextDueDate) as
      | string
      | undefined;

  return safeParseDate(dueDateValue);
}

export function getLifecycleStatus(asset: Asset): "active" | "expired" | "dueSoon" {
  const today = toStartOfDay(new Date());
  const dates = [getWarrantyEndDate(asset), getInsuranceEndDate(asset), getServiceDueDate(asset)]
    .filter((value): value is Date => value !== null)
    .map((value) => toStartOfDay(value));

  if (dates.length === 0) {
    return "active";
  }

  const nearest = new Date(Math.min(...dates.map((date) => date.getTime())));

  if (nearest < today) {
    return "expired";
  }

  const diffDays = (nearest.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) {
    return "dueSoon";
  }

  return "active";
}

export function getAssetStatus(asset: Asset): AssetStatus {
  const explicit = String((asset as Asset & { status?: string }).status || "").trim().toLowerCase();
  if (explicit === "inactive") {
    return "inactive";
  }

  return getLifecycleStatus(asset);
}

export function calculateAssetCounts(assets: Asset[]) {
  return assets.reduce(
    (acc, asset) => {
      const status = getAssetStatus(asset);
      acc.total += 1;
      acc[status] += 1;
      return acc;
    },
    {
      total: 0,
      active: 0,
      expired: 0,
      dueSoon: 0,
      inactive: 0,
    }
  );
}

export function assetMatchesFilter(asset: Asset, filter: AssetFilter | string): boolean {
  const normalized = String(filter || "all").trim();
  if (normalized === "all") return true;
  if (normalized === "inactive") return getAssetStatus(asset) === "inactive";
  return getAssetStatus(asset) === normalized;
}

export function getAssetStatusLabel(asset: Asset): string {
  const status = getAssetStatus(asset);
  if (status === "dueSoon") return "Due Soon";
  if (status === "inactive") return "Inactive";
  if (status === "expired") return "Expired";
  return "Active";
}

import { Asset } from "../services/gmail";

export type AssetStatus = "active" | "expired" | "dueSoon" | "inWarranty" | "inactive";
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

export function getLifecycleStatus(asset: Asset): "active" | "expired" | "dueSoon" | "inWarranty" {
  const today = toStartOfDay(new Date());
  
  // Get all relevant dates: warranty, insurance, service
  const warrantyEnd = getWarrantyEndDate(asset);
  const insuranceEnd = getInsuranceEndDate(asset);
  const serviceEnd = getServiceDueDate(asset);
  
  const dates = [warrantyEnd, insuranceEnd, serviceEnd]
    .filter((value): value is Date => value !== null)
    .map((value) => toStartOfDay(value));

  if (dates.length === 0) {
    return "active"; // No dates defined, asset is active
  }

  // Find the nearest date
  const nearest = new Date(Math.min(...dates.map((date) => date.getTime())));

  // Check if expired
  if (nearest < today) {
    return "expired";
  }

  // Check if expiring soon (within 30 days, changed from 7 to 30)
  const diffDays = (nearest.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 30) {
    return "dueSoon";
  }

  // Has valid warranty
  return "inWarranty";
}

/**
 * Derive asset status from lifecycle data and inactive flag
 * 
 * 1. If explicitly marked inactive → "Inactive"
 * 2. If warranty/insurance/service expired → "Expired"
 * 3. If warranty/insurance/service expiring within 30 days → "Expiring Soon"
 * 4. If warranty/insurance/service valid → "In Warranty"
 * 5. Else → "Active"
 */
export function getAssetStatus(asset: Asset): AssetStatus {
  // Check if asset is marked as inactive
  const isInactive = (asset as Asset & { is_inactive?: boolean }).is_inactive === true;
  if (isInactive) {
    return "inactive";
  }

  // Otherwise derive from lifecycle (warranty, insurance, service dates)
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
      inWarranty: 0,
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

/**
 * Returns the exact DB status master label for this asset.
 * Derived internal codes are mapped 1-to-1 to the DB status_master names.
 * This is the single mapping layer — all UI display, filters, and counts use this.
 */
export function getAssetStatusLabel(asset: Asset): string {
  const status = getAssetStatus(asset);
  if (status === "dueSoon") return "Expiring Soon"; // DB value: "Expiring Soon"
  if (status === "inactive") return "Inactive";      // DB value: "Inactive"
  if (status === "expired") return "Expired";        // DB value: "Expired"
  if (status === "inWarranty") return "In Warranty"; // DB value: "In Warranty"
  return "Active";                                   // DB value: "Active"
}

export const STATUS_OPTIONS = [
  "Active",
  "In Warranty",
  "Expiring Soon",
  "Expired",
  "Inactive",
  "Lost",
  "Damaged",
] as const;

export type StatusOption = (typeof STATUS_OPTIONS)[number];

export const normalizeStatusOption = (status: string | undefined | null): "" | StatusOption => {
  if (!status) return "";

  const s = status.trim().toLowerCase();

  if (s === "inactive") return "Inactive";
  if (s === "active") return "Active";
  if (s.includes("warranty")) return "In Warranty";
  if (s.includes("expiring")) return "Expiring Soon";
  if (s.includes("expired")) return "Expired";
  if (s === "lost") return "Lost";
  if (s === "damaged") return "Damaged";


  return "";
};

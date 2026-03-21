import { Asset } from "../services/gmail.ts";
import { getInsuranceEndDate, getServiceDueDate, getWarrantyEndDate } from "./assetStatus.ts";

export type CriticalAssetInsights = {
  criticalAssets: Asset[];
  criticalItemsThisWeek: number;
  expiringSoon7Days: number;
  overdueService: number;
  expiredInsurance: number;
};

const toStartOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const getCriticalAssetInsights = (assets: Asset[], windowDays = 7): CriticalAssetInsights => {
  const today = toStartOfDay(new Date());
  const nextWindow = new Date(today);
  nextWindow.setDate(nextWindow.getDate() + windowDays);

  let expiringSoon7Days = 0;
  let overdueService = 0;
  let expiredInsurance = 0;

  const criticalAssets: Asset[] = [];

  for (const asset of assets) {
    const warrantyEnd = getWarrantyEndDate(asset);
    const insuranceEnd = getInsuranceEndDate(asset);
    const serviceDue = getServiceDueDate(asset);

    let isCritical = false;

    if (insuranceEnd && insuranceEnd < today) {
      expiredInsurance += 1;
      isCritical = true;
    }

    if (serviceDue && serviceDue < today) {
      overdueService += 1;
      isCritical = true;
    }

    if (warrantyEnd && warrantyEnd >= today && warrantyEnd <= nextWindow) {
      expiringSoon7Days += 1;
      isCritical = true;
    }

    if (insuranceEnd && insuranceEnd >= today && insuranceEnd <= nextWindow) {
      expiringSoon7Days += 1;
      isCritical = true;
    }

    if (isCritical) {
      criticalAssets.push(asset);
    }
  }

  return {
    criticalAssets,
    criticalItemsThisWeek: criticalAssets.length,
    expiringSoon7Days,
    overdueService,
    expiredInsurance,
  };
};

export const getCriticalAssets = (assets: Asset[], windowDays = 7): Asset[] => {
  return getCriticalAssetInsights(assets, windowDays).criticalAssets;
};

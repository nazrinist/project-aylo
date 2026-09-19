import type { ProviderSearchSource } from "@/types/provider";

export type AvailabilitySlot = {
  id: string;
  businessId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
};

export type CheckAvailabilityToolResult = {
  source: ProviderSearchSource;
  slots: AvailabilitySlot[];
};

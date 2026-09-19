export type BookingDraft = {
  requestId: string | null;
  availabilityId: string;
  businessId: string;
  businessName: string;
  serviceId: string;
  serviceName: string;
  address: string;
  bookedFor: string;
  durationMinutes: number | null;
  price: number;
  currency: string;
};

export type BookingConfirmation = BookingDraft & {
  userConfirmed: true;
  confirmedAt: string;
};

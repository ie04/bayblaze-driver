import type { Timestamp } from "firebase/firestore";

export type DriverAllowlistRecord = {
  email: string;
  active: boolean;
  createdAt?: Timestamp;
  createdBy?: string;
  notes?: string;
};

export type DriverProfile = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profilePhotoPath?: string;
  profilePhotoUrl?: string;
  bio: string;
  onboardingComplete: boolean;
  activeVehicleId?: string;
  clockedIn: boolean;
  clockedInAt?: Timestamp;
  clockedOutAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type VehicleRecord = {
  vehicleId: string;
  label: string;
  plateNumber?: string;
  make?: string;
  model?: string;
  color?: string;
  active: boolean;
  linkedDriverUid?: string;
  linkedAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type DriverLocationSnapshot = {
  uid: string;
  vehicleId: string;
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  clockedIn: true;
  source: "driver-pwa";
  clientCapturedAt: number;
  updatedAt?: Timestamp;
};

export type DeliveryItemInventoryLocation = "vehicle" | "warehouse";

export type DeliveryStopStatus = "current" | "locked" | "scored";

export type DriverDeliveryItem = {
  id: string;
  productId?: string;
  variantId?: string;
  name: string;
  variant: string;
  quantity: number;
  imageUrl: string;
  inventoryLocation: DeliveryItemInventoryLocation;
};

export type DriverDeliveryStop = {
  orderId: string;
  customerName: string;
  customerAddress: string;
  status: DeliveryStopStatus;
  locked: boolean;
  score?: number;
  eta?: string;
  items: DriverDeliveryItem[];
};

export type DriverDeliveryQueue = {
  uid: string;
  activeOrderId?: string;
  stops: DriverDeliveryStop[];
  updatedAt?: Timestamp;
};

export type DriverSignupMode = "login" | "code_sent";

export type PasswordValidation = {
  minLength: boolean;
  lettersAndNumbers: boolean;
  symbol: boolean;
};

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

export type DriverSignupMode = "login" | "code_sent";

export type PasswordValidation = {
  minLength: boolean;
  lettersAndNumbers: boolean;
  symbol: boolean;
};

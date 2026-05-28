// /src/types.ts
//
// Speilet 1:1 av typene fra mobilappen — gjør at vi kan dele payloads
// uten konvertering, og at TS-kompilatoren fanger drift mellom de to.

export type UserRole =
  | "admin"
  | "med_ansvarlig"
  | "abc_prep"
  | "c_prep"
  | "dobbelsign";

export type ReseptgruppeType = "A" | "B" | "C" | "CF" | "K";

export interface Tenant {
  id: string;
  name: string;             // "Jessheim Legevakt"
  orgNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  pharmacistEmail?: string; // for årsrapport-utsendelse
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  employeeNumber: string;
  name: string;
  title?: string;
  role: UserRole;
  nfcCardUid?: string;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface NfcCardMapping {
  hardwareUid: string;
  employeeNumber: string;
  registeredAt: string;
  registeredBy: string;
  tenantId: string;
}

export interface InventoryBatch {
  id: string;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  receivedAt: string;
  receivedBy: string;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  medicineId: string;
  medicineName: string;
  medicineAtc: string;
  nameFormStrength: string;
  navnFormStyrke: string;
  form: string;
  strength: string;
  reseptgruppe?: ReseptgruppeType;
  unopenedPackages: number;
  unitsPerPackage: number;
  openedContainerRemaining: number;
  isUnitOnly?: boolean;
  batches: InventoryBatch[];
  lowStockThreshold: number;
  desiredStock?: number;       // ønsket beholdning (brukes til bestillingsliste)
  pakningsstr: string;
  enhetPakning: string;
  pakningstype?: string;
  lastUpdated: string;
}

export interface DispensingRecord {
  id: string;
  tenantId: string;
  medicineId: string;
  medicineName: string;
  form: string;
  strength: string;
  amount: number;
  amountUnit: string;
  patientInitials: string;
  dob: string;
  reseptgruppe?: ReseptgruppeType;
  remainingCountEntered: number;
  remainingCountExpected: number;
  countDiscrepancy: boolean;
  signer1Id: string;
  signer1Method: "nfc" | "password" | "simple";
  signer2Id?: string;
  signer2Method?: "nfc" | "password" | "simple";
  doubleSignRequired: boolean;
  doubleSignCompleted: boolean;
  doubleSignPostponed: boolean;
  dispensedAt: string;
  isEmergencyMode: boolean;
  linkedBatchId?: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
}

export interface WasteRecord {
  id: string;
  tenantId: string;
  medicineId: string;
  medicineName: string;
  form: string;
  strength: string;
  amount: number;
  amountUnit: string;
  linkedDispensingId?: string;
  signedBy: string;
  signer2Id?: string;
  doubleSignRequired: boolean;
  doubleSignCompleted: boolean;
  reseptgruppe?: ReseptgruppeType;
  createdAt: string;
  reversedAt?: string;
  reversedBy?: string;
}

export interface DeliveryItem {
  id: string;
  medicineId: string;
  medicineName: string;
  navnFormStyrke: string;
  nameFormStrength: string;
  form: string;
  strength: string;
  quantity: number;
  unitsPerPackage: number;
  expirationDate: string;
  batchNumber: string;
  pakningsstr: string;
  enhetPakning: string;
}

export interface DeliveryDeviation {
  id: string;
  type:
    | "wrong_quantity"
    | "wrong_product"
    | "damaged"
    | "missing"
    | "expired_on_arrival"
    | "temperature"
    | "other";
  description: string;
  itemId?: string;
  photoUri?: string;
  reportedAt: string;
  reportedBy: string;
}

export interface DeliveryReceipt {
  id: string;
  tenantId: string;
  items: DeliveryItem[];
  deviations: DeliveryDeviation[];
  completedAt: string;
  signedBy: string;
  signMethod: string;
  signer2Id?: string;
  doubleSignRequired?: boolean;
  doubleSignCompleted?: boolean;
  packingSlipPhotoUrl?: string;
}

export type AlertType =
  | "count_discrepancy"
  | "postponed_double_sign"
  | "low_stock"
  | "expiring_medicine"
  | "admin_escalation";

export interface Alert {
  id: string;
  tenantId: string;
  type: AlertType;
  title: string;
  description: string;
  details: Record<string, any>;
  deadline?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  escalated: boolean;
  escalatedAt?: string;
  relatedUserId?: string;
  relatedMedicineId?: string;
  relatedDispensingId?: string;
}

export type ActionType =
  | "LOGIN"
  | "LOGOUT"
  | "AUTO_LOGOUT"
  | "DELIVERY_RECEIPT"
  | "DELIVERY_DEVIATION"
  | "DELIVERY_PHOTO"
  | "DISPENSE"
  | "DISPENSE_SIGN_1"
  | "DISPENSE_SIGN_2"
  | "DISPENSE_POSTPONE_SIGN_2"
  | "DISPENSE_UNDO"
  | "WASTE_POSTPONE_SIGN_2"
  | "WASTE_UNDO"
  | "COUNT_DISCREPANCY"
  | "COUNT_CORRECTION"
  | "INVENTORY_EDIT"
  | "WASTE_REGISTRATION"
  | "WASTE_COUNT_SKIPPED"
  | "WASTE_COUNT_DISCREPANCY"
  | "ALERT_CREATED"
  | "ALERT_RESOLVED"
  | "ALERT_ESCALATED"
  | "NFC_CARD_REGISTERED"
  | "EMPLOYEE_CREATED"
  | "SETTINGS_CHANGED"
  | "API_CONFIGURED"
  | "EMERGENCY_MODE_ON"
  | "EMERGENCY_MODE_OFF"
  | "BATCH_DELETE"
  | "BATCH_EDIT"
  | "MIXTURE_OPENED"
  | "ADMIN_VIEW"
  | "ADMIN_EDIT"
  | "ALERT_UNRESOLVED"
  | "ALERT_DEESCALATED"
  | "DISPENSE_UNREVERSED";

export interface ActionLog {
  id: string;
  tenantId: string;
  timestamp: string;
  userId: string;
  actionType: ActionType;
  medicineId?: string;
  details: Record<string, any>;
}

export interface RemoteConfig {
  autoLogoutMinutes: number;
  lowStockThresholdDefault: number;
  expirationWarningDays: number;
  alertDeadlines: {
    postponedDoubleSignMinutes: number;
    countDiscrepancyMinutes: number;
    lowStockGraceHours: number;
    expirationGraceHours: number;
  };
  features: {
    allowUndoDispense: boolean;
    requireDoubleSignForCprepUndo: boolean;
    requireDeliveryPhoto: boolean;
    cPrepRequiresPatientId: boolean;
    enableNfc: boolean;
    enableEmergencyMode: boolean;
    pushNotifications: boolean;
  };
  version: string;
  fetchedAt: string;
}

// ─── UI-side typer (kun for admin-nettsiden) ────────────────────
export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7"
  | "last_30"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "all"
  | "custom";

export interface DateRange {
  preset: DateRangePreset;
  from: string; // ISO
  to: string;   // ISO
}

export interface OrderListEntry {
  medicineId: string;
  medicineName: string;
  reseptgruppe?: ReseptgruppeType;
  currentTotal: number;       // alt på lager
  threshold: number;
  desired: number;            // ønsket nivå
  suggestedOrder: number;     // desired - current
  avgDailyUse: number;        // siste 30 dager
  daysUntilEmpty: number | null;
  urgency: "critical" | "high" | "normal";
}

export interface ReportRange {
  label: string;
  from: string;
  to: string;
}

export interface DashboardStats {
  dispenses24h: number;
  dispenses7d: number;
  dispenses30d: number;
  openAlerts: number;
  lowStockItems: number;
  expiringSoonItems: number;
  activeEmployees: number;
  emergencyMode: boolean;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  tenant: Tenant;
  user: User;
}

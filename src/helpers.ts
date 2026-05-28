// /src/helpers.ts
import DOMPurify from "dompurify";
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { nb } from "date-fns/locale";

import type {
  ActionType,
  DateRange,
  DateRangePreset,
  InventoryItem,
  OrderListEntry,
  DispensingRecord,
  ReseptgruppeType,
  UserRole,
} from "./types";

export function cn(
  ...inputs: Array<string | false | undefined | null>
): string {
  return inputs.filter(Boolean).join(" ");
}

// ─── Sikker innsetting av tekst som kan inneholde HTML ────────────
export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

// ─── Formattere ───────────────────────────────────────────────────
export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd.MM.yyyy", { locale: nb });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd.MM.yyyy HH:mm:ss", { locale: nb });
  } catch {
    return iso;
  }
}

export function fmtTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "HH:mm", { locale: nb });
  } catch {
    return iso;
  }
}

export function fmtRelativeShort(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = parseISO(iso).getTime();
  const diff = Date.now() - d;
  if (diff < 60_000) return "nå";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} t`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} d`;
  return fmtDate(iso);
}

export function fmtInt(n: number): string {
  return new Intl.NumberFormat("nb-NO").format(n);
}

// ─── Roller ───────────────────────────────────────────────────────
export function roleLabel(role?: UserRole | string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "med_ansvarlig":
      return "Med-ansvarlig";
    case "abc_prep":
      return "ABC-Prep.";
    case "c_prep":
      return "C-Prep.";
    case "dobbelsign":
      return "Dobbelsign.";
    default:
      return role ?? "—";
  }
}

export function isAdmin(role?: UserRole | string): boolean {
  return role === "admin";
}

export function canManageEmployees(role?: UserRole | string): boolean {
  return role === "admin";
}

export function canEditInventory(role?: UserRole | string): boolean {
  return role === "admin" || role === "med_ansvarlig";
}

// ─── Resept-gruppe-rangering (for sortering A→B→C→CF→K) ───────────
export function reseptOrder(g?: ReseptgruppeType): number {
  switch (g) {
    case "A":
      return 0;
    case "B":
      return 1;
    case "C":
      return 2;
    case "CF":
      return 3;
    case "K":
      return 4;
    default:
      return 99;
  }
}

// ─── Lager-aritmetikk ─────────────────────────────────────────────
export function inventoryTotalUnits(item: InventoryItem): number {
  if (item.isUnitOnly) return item.unopenedPackages;
  return (
    item.unopenedPackages * (item.unitsPerPackage || 1) +
    (item.openedContainerRemaining || 0)
  );
}

export function unitLabel(item: InventoryItem, count = 1): string {
  if (item.isUnitOnly) return count === 1 ? "enhet" : "enheter";
  return item.enhetPakning || "stk";
}

export function nextExpiry(item: InventoryItem): string | null {
  if (!item.batches?.length) return null;
  const sorted = [...item.batches].sort((a, b) =>
    a.expirationDate.localeCompare(b.expirationDate),
  );
  return sorted[0]?.expirationDate ?? null;
}

export function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return parseISO(iso).getTime() <= Date.now();
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return differenceInCalendarDays(parseISO(iso), new Date());
}

// ─── Smart bestillingsliste ───────────────────────────────────────
/**
 * Bygg en bestillingsliste basert på lager + forbruksrate.
 * - currentTotal under threshold → med på listen
 * - suggested = max(desired - current, threshold + bufferDays * avgDaily - current)
 * - urgency: "critical" hvis tomt (current === 0) eller daysUntilEmpty <= 3,
 *           "high" hvis daysUntilEmpty <= 7, ellers "normal".
 */
export function buildOrderList(
  inventory: InventoryItem[],
  dispensings: DispensingRecord[],
  bufferDays = 14,
): OrderListEntry[] {
  const now = Date.now();
  const cutoff = now - 30 * 86_400_000;
  const dispCountByMed = new Map<string, number>();
  for (const d of dispensings) {
    if (d.reversedAt) continue;
    const t = parseISO(d.dispensedAt).getTime();
    if (t < cutoff) continue;
    dispCountByMed.set(
      d.medicineId,
      (dispCountByMed.get(d.medicineId) ?? 0) + d.amount,
    );
  }

  const list: OrderListEntry[] = [];
  for (const item of inventory) {
    const current = inventoryTotalUnits(item);
    if (current > item.lowStockThreshold) continue;
    const used30 = dispCountByMed.get(item.medicineId) ?? 0;
    const avgDaily = used30 / 30;
    const desired =
      item.desiredStock ??
      Math.max(item.lowStockThreshold * 2, Math.ceil(avgDaily * bufferDays));
    const suggestedOrder = Math.max(0, desired - current);
    const daysUntilEmpty = avgDaily > 0 ? Math.floor(current / avgDaily) : null;
    let urgency: OrderListEntry["urgency"] = "normal";
    if (current === 0 || (daysUntilEmpty !== null && daysUntilEmpty <= 3))
      urgency = "critical";
    else if (daysUntilEmpty !== null && daysUntilEmpty <= 7) urgency = "high";

    list.push({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      reseptgruppe: item.reseptgruppe,
      currentTotal: current,
      threshold: item.lowStockThreshold,
      desired,
      suggestedOrder,
      avgDailyUse: Math.round(avgDaily * 10) / 10,
      daysUntilEmpty,
      urgency,
    });
  }

  return list.sort((a, b) => {
    const urgencyRank = { critical: 0, high: 1, normal: 2 };
    if (urgencyRank[a.urgency] !== urgencyRank[b.urgency])
      return urgencyRank[a.urgency] - urgencyRank[b.urgency];
    return a.medicineName.localeCompare(b.medicineName, "nb");
  });
}

// ─── Tidsvindu / range-presets ────────────────────────────────────
export function buildRange(preset: DateRangePreset, now = new Date()): DateRange {
  const iso = (d: Date) => d.toISOString();
  switch (preset) {
    case "today":
      return { preset, from: iso(startOfDay(now)), to: iso(endOfDay(now)) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { preset, from: iso(startOfDay(y)), to: iso(endOfDay(y)) };
    }
    case "last_7":
      return {
        preset,
        from: iso(startOfDay(subDays(now, 6))),
        to: iso(endOfDay(now)),
      };
    case "last_30":
      return {
        preset,
        from: iso(startOfDay(subDays(now, 29))),
        to: iso(endOfDay(now)),
      };
    case "this_week":
      return {
        preset,
        from: iso(startOfWeek(now, { weekStartsOn: 1 })),
        to: iso(endOfWeek(now, { weekStartsOn: 1 })),
      };
    case "last_week": {
      const lw = subWeeks(now, 1);
      return {
        preset,
        from: iso(startOfWeek(lw, { weekStartsOn: 1 })),
        to: iso(endOfWeek(lw, { weekStartsOn: 1 })),
      };
    }
    case "this_month":
      return { preset, from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { preset, from: iso(startOfMonth(lm)), to: iso(endOfMonth(lm)) };
    }
    case "this_quarter":
      return {
        preset,
        from: iso(startOfQuarter(now)),
        to: iso(endOfQuarter(now)),
      };
    case "this_year":
      return { preset, from: iso(startOfYear(now)), to: iso(endOfYear(now)) };
    case "all":
      return {
        preset,
        from: iso(new Date("2000-01-01")),
        to: iso(addDays(now, 1)),
      };
    case "custom":
    default:
      return {
        preset: "custom",
        from: iso(startOfDay(now)),
        to: iso(endOfDay(now)),
      };
  }
}

export function rangeLabel(r: DateRange): string {
  const m: Record<DateRangePreset, string> = {
    today: "I dag",
    yesterday: "I går",
    last_7: "Siste 7 dager",
    last_30: "Siste 30 dager",
    this_week: "Denne uken",
    last_week: "Forrige uke",
    this_month: "Denne måneden",
    last_month: "Forrige måned",
    this_quarter: "Dette kvartalet",
    this_year: "I år",
    all: "Hele perioden",
    custom: `${fmtDate(r.from)} – ${fmtDate(r.to)}`,
  };
  return m[r.preset];
}

export function inRange(iso: string | undefined, r: DateRange): boolean {
  if (!iso) return false;
  return iso >= r.from && iso <= r.to;
}

// ─── CSV-eksport ──────────────────────────────────────────────────
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Liten haptisk lyd-feedback (på desktop er vibrator no-op) ────
export function feedback(kind: "success" | "warn" | "error" = "success") {
  try {
    if ("vibrate" in navigator) {
      const ms = kind === "error" ? [60, 40, 60] : kind === "warn" ? [40] : [25];
      navigator.vibrate(ms as unknown as number);
    }
  } catch {}
}

// ─── Debounce ─────────────────────────────────────────────────────
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms = 250,
): (...args: Parameters<T>) => void {
  let id: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (id) clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
}

// ─── Initialer (avatar) ───────────────────────────────────────────
export function initialsOf(name?: string): string {
  if (!name) return "·";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

// ─── Tamper-evident hash for offline-eksport ──────────────────────
export async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Print-utløser m/dedikert tittel ──────────────────────────────
export function printPage(title?: string) {
  const original = document.title;
  if (title) document.title = title;
  window.print();
  // Etter et lite delay nullstilles tittelen (Chrome/Safari trenger det)
  window.setTimeout(() => {
    document.title = original;
  }, 600);
}

// ─── ID-generator (lokalt; server gjenutsteder ved persist) ───────
export function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Lesbare navn på revisjonslogg-handlinger ─────────────────────
const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Logget inn",
  LOGOUT: "Logget ut",
  AUTO_LOGOUT: "Logget ut automatisk",
  DISPENSE: "Uttak gjennomført",
  DISPENSE_SIGN_1: "Uttak signert (første)",
  DISPENSE_SIGN_2: "Uttak signert (andre)",
  DISPENSE_POSTPONE_SIGN_2: "Andresignering utsatt",
  DISPENSE_UNDO: "Uttak reversert",
  DELIVERY_RECEIPT: "Vareleveranse mottatt",
  DELIVERY_DEVIATION: "Avvik på vareleveranse",
  DELIVERY_PHOTO: "Bilde av pakkseddel lagt til",
  INVENTORY_EDIT: "Lager endret",
  BATCH_EDIT: "Batch endret",
  BATCH_DELETE: "Batch slettet",
  MIXTURE_OPENED: "Mikstur åpnet",
  COUNT_DISCREPANCY: "Telleavvik oppdaget",
  COUNT_CORRECTION: "Telling korrigert",
  WASTE_REGISTRATION: "Svinn registrert",
  WASTE_UNDO: "Svinn reversert",
  WASTE_POSTPONE_SIGN_2: "Andresignering utsatt (svinn)",
  WASTE_COUNT_SKIPPED: "Telling hoppet over (svinn)",
  WASTE_COUNT_DISCREPANCY: "Telleavvik (svinn)",
  ALERT_CREATED: "Varsel opprettet",
  ALERT_RESOLVED: "Varsel markert som løst",
  ALERT_ESCALATED: "Varsel eskalert",
  ALERT_UNRESOLVED: "Varsel gjenåpnet",
  ALERT_DEESCALATED: "Varsel de-eskalert",
  DISPENSE_UNREVERSED: "Reversering angret",
  NFC_CARD_REGISTERED: "NFC-kort registrert",
  EMPLOYEE_CREATED: "Ansatt opprettet",
  SETTINGS_CHANGED: "Innstillinger endret",
  API_CONFIGURED: "API konfigurert",
  EMERGENCY_MODE_ON: "Nødmodus slått på",
  EMERGENCY_MODE_OFF: "Nødmodus slått av",
  ADMIN_VIEW: "Admin viste data",
  ADMIN_EDIT: "Admin endret data",
};

export function actionLabel(type: ActionType | string): string {
  return (
    ACTION_LABELS[type] ??
    type
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

// ─── Lesbare navn på detalj-nøkler ────────────────────────────────
const DETAIL_KEY_LABELS: Record<string, string> = {
  id: "ID",
  type: "Type",
  reason: "Begrunnelse",
  value: "Verdi",
  emp: "Ansatt",
  employeeNumber: "Ansattnummer",
  role: "Rolle",
  medicineId: "Medisin-ID",
  threshold: "Terskel",
  desired: "Ønsket beholdning",
  unopenedPackages: "Uåpnede pakker",
  openedContainerRemaining: "Igjen i åpnet",
  lowStockThreshold: "Lav-terskel",
  desiredStock: "Ønsket beholdning",
  amount: "Mengde",
  amountUnit: "Enhet",
  patientInitials: "Pasient",
  dob: "Fødselsdato",
  password_reset: "Passord nullstilt",
  user_active: "Bruker-status",
  user: "Bruker",
  batchNumber: "Batch",
  expirationDate: "Utløpsdato",
  count: "Antall",
};

function labelForDetailKey(k: string): string {
  return DETAIL_KEY_LABELS[k] ?? k.replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, c => c.toUpperCase());
}

function formatDetailValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Ja" : "Nei";
  if (typeof v === "number" || typeof v === "string") return String(v);
  if (Array.isArray(v)) return v.map(formatDetailValue).join(", ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, vv]) => `${labelForDetailKey(k)}: ${formatDetailValue(vv)}`)
      .join(", ");
  }
  return String(v);
}

/** Render the JSON details column of an audit log as readable Norwegian text. */
export function fmtLogDetails(details: Record<string, any> | null | undefined): string {
  if (!details || typeof details !== "object" || Object.keys(details).length === 0) {
    return "—";
  }
  return Object.entries(details)
    .map(([k, v]) => `${labelForDetailKey(k)}: ${formatDetailValue(v)}`)
    .join(" · ");
}

// ─── Tilbakemap: hvilken kategori hører en handling til? ───────────
export const LOG_CATEGORY_FOR: Record<string, string> = {
  LOGIN: "auth",
  LOGOUT: "auth",
  AUTO_LOGOUT: "auth",
  DISPENSE: "disp",
  DISPENSE_SIGN_1: "disp",
  DISPENSE_SIGN_2: "disp",
  DISPENSE_POSTPONE_SIGN_2: "disp",
  DISPENSE_UNDO: "disp",
  DISPENSE_UNREVERSED: "disp",
  DELIVERY_RECEIPT: "stock",
  DELIVERY_DEVIATION: "stock",
  DELIVERY_PHOTO: "stock",
  INVENTORY_EDIT: "stock",
  BATCH_EDIT: "stock",
  BATCH_DELETE: "stock",
  MIXTURE_OPENED: "stock",
  COUNT_DISCREPANCY: "stock",
  COUNT_CORRECTION: "stock",
  WASTE_REGISTRATION: "waste",
  WASTE_UNDO: "waste",
  WASTE_POSTPONE_SIGN_2: "waste",
  WASTE_COUNT_SKIPPED: "waste",
  WASTE_COUNT_DISCREPANCY: "waste",
  ALERT_CREATED: "alert",
  ALERT_RESOLVED: "alert",
  ALERT_ESCALATED: "alert",
  ALERT_UNRESOLVED: "alert",
  ALERT_DEESCALATED: "alert",
  EMPLOYEE_CREATED: "admin",
  NFC_CARD_REGISTERED: "admin",
  SETTINGS_CHANGED: "admin",
  API_CONFIGURED: "admin",
  EMERGENCY_MODE_ON: "admin",
  EMERGENCY_MODE_OFF: "admin",
  ADMIN_VIEW: "admin",
  ADMIN_EDIT: "admin",
};

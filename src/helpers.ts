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

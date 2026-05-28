// /src/api.ts
//
// API-klient for Ventral VaktApotek-admin.
// Multi-tenant er IMPLISITT: JWT (utstedt av WordPress-bridge) inneholder
// `tenant_id`-claim. Vi sender bare cookie/Authorization-header — server
// avgjør tilgang. Klienten kan dermed ikke "rote" data mellom legevakter.
//
// Token-strategi: HttpOnly-cookie (best practice, motstandsdyktig mot XSS).
// Fallback: hvis cookie ikke kan settes (f.eks. dev mot annen origin),
// faller vi til Authorization-header med token i memory + sessionStorage.
//
// CSRF: server utsteder en X-CSRF-Token i samme respons som login —
// vi sender den tilbake på alle skrivekall.

import { decodeJwt } from "jose";

import { Storage } from "./storage";
import type {
  ActionLog,
  Alert,
  AuthSession,
  DashboardStats,
  DeliveryReceipt,
  DispensingRecord,
  InventoryItem,
  NfcCardMapping,
  RemoteConfig,
  Tenant,
  User,
  WasteRecord,
} from "./types";

const RAW_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://ventral.no/medisinrom_backend/wp-json/vaktapotek/v1";

export const API_BASE = RAW_BASE.replace(/\/$/, "");

// In-memory state — overlever ikke reload. SessionStorage er fallback.
let memoryToken: string | null = null;
let memoryCsrf: string | null = null;

function readSessionToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const t = sessionStorage.getItem("vp_admin_token");
    if (t) {
      memoryToken = t;
      return t;
    }
  } catch {}
  return null;
}

function persistSessionToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem("vp_admin_token", token);
    else sessionStorage.removeItem("vp_admin_token");
  } catch {}
}

function readCsrf(): string | null {
  if (memoryCsrf) return memoryCsrf;
  try {
    const c = sessionStorage.getItem("vp_admin_csrf");
    if (c) {
      memoryCsrf = c;
      return c;
    }
  } catch {}
  return null;
}

function persistCsrf(t: string | null) {
  memoryCsrf = t;
  try {
    if (t) sessionStorage.setItem("vp_admin_csrf", t);
    else sessionStorage.removeItem("vp_admin_csrf");
  } catch {}
}

interface FetchOpts extends Omit<RequestInit, "body"> {
  body?: unknown;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

class ApiError extends Error {
  status: number;
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function http<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((opts.headers as Record<string, string>) ?? {}),
  };

  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(
    (opts.method ?? "GET").toUpperCase(),
  );

  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (!opts.skipAuth) {
    const token = readSessionToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  if (isWrite) {
    const csrf = readCsrf();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      credentials: "include",
      headers,
      body:
        opts.body instanceof FormData
          ? opts.body
          : opts.body
            ? JSON.stringify(opts.body)
            : undefined,
    });
  } catch (e: any) {
    throw new ApiError(e?.message ?? "Nettverksfeil", 0);
  }

  // Server roterer CSRF: les den ut hvis den finnes
  const newCsrf = res.headers.get("X-CSRF-Token");
  if (newCsrf) persistCsrf(newCsrf);

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      // utløpt session — kast bruker tilbake til login
      persistSessionToken(null);
      persistCsrf(null);
      window.dispatchEvent(new Event("vp:unauthorized"));
    }
    throw new ApiError(
      json?.message ?? `Forespørsel feilet (${res.status})`,
      res.status,
      json,
    );
  }
  return json as T;
}

// ─────────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────────
export const auth = {
  async login(employeeNumber: string, password: string): Promise<AuthSession> {
    const r = await http<{
      token: string;
      csrf: string;
      tenant: Tenant;
      user: User;
    }>("/auth/login", {
      method: "POST",
      body: { employeeNumber, password },
      skipAuth: true,
    });
    persistSessionToken(r.token);
    persistCsrf(r.csrf);
    let expiresAt = new Date(Date.now() + 8 * 3600_000).toISOString();
    try {
      const claims = decodeJwt(r.token);
      if (claims.exp) expiresAt = new Date(claims.exp * 1000).toISOString();
    } catch {}
    return { token: r.token, expiresAt, tenant: r.tenant, user: r.user };
  },

  async logout(): Promise<void> {
    try {
      await http("/auth/logout", { method: "POST" });
    } catch {}
    persistSessionToken(null);
    persistCsrf(null);
  },

  async me(): Promise<{ tenant: Tenant; user: User } | null> {
    try {
      return await http("/auth/me");
    } catch (e: any) {
      if (e?.status === 401) return null;
      throw e;
    }
  },

  isAuthenticated(): boolean {
    return !!readSessionToken();
  },

  /** Hent kun tenant-id fra et token uten å treffe serveren. */
  parseTenantId(): string | null {
    const t = readSessionToken();
    if (!t) return null;
    try {
      const claims = decodeJwt(t) as { tenant_id?: string };
      return claims.tenant_id ?? null;
    } catch {
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────────────────
//  RESSURSER
// ─────────────────────────────────────────────────────────────────
export const api = {
  // Dashboard
  stats: () => http<DashboardStats>("/stats"),

  // Brukere
  users: {
    list: () => http<User[]>("/users"),
    create: (payload: Partial<User> & { password: string }) =>
      http<User>("/users", { method: "POST", body: payload }),
    update: (id: string, payload: Partial<User> & { password?: string }) =>
      http<User>(`/users/${id}`, { method: "PUT", body: payload }),
    deactivate: (id: string) =>
      http(`/users/${id}/deactivate`, { method: "POST" }),
    activate: (id: string) => http(`/users/${id}/activate`, { method: "POST" }),
    resetPassword: (id: string, password: string) =>
      http(`/users/${id}/password`, { method: "PUT", body: { password } }),
  },

  // NFC
  nfc: {
    list: () => http<NfcCardMapping[]>("/nfc"),
    register: (payload: { hardwareUid: string; employeeNumber: string }) =>
      http<NfcCardMapping>("/nfc", { method: "POST", body: payload }),
    unregister: (uid: string) =>
      http(`/nfc/${encodeURIComponent(uid)}`, { method: "DELETE" }),
  },

  // Lager
  inventory: {
    list: () => http<InventoryItem[]>("/inventory"),
    update: (id: string, payload: Partial<InventoryItem>) =>
      http<InventoryItem>(`/inventory/${id}`, {
        method: "PUT",
        body: payload,
      }),
    setThreshold: (id: string, threshold: number) =>
      http(`/inventory/${id}/threshold`, {
        method: "PUT",
        body: { lowStockThreshold: threshold },
      }),
    setDesired: (id: string, desired: number) =>
      http(`/inventory/${id}/desired`, {
        method: "PUT",
        body: { desiredStock: desired },
      }),
    setStock: (
      id: string,
      payload: {
        unopenedPackages: number;
        openedContainerRemaining: number;
      },
    ) =>
      http(`/inventory/${id}/stock`, {
        method: "PUT",
        body: payload,
      }),
  },

  // Uttak
  dispensings: {
    list: (from?: string, to?: string) =>
      http<DispensingRecord[]>(
        `/dispensings${from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ""}`,
      ),
    reverse: (id: string, reason: string) =>
      http(`/dispensings/${id}/reverse`, {
        method: "POST",
        body: { reason },
      }),
    unreverse: (id: string, reason: string) =>
      http(`/dispensings/${id}/unreverse`, {
        method: "POST",
        body: { reason },
      }),
  },

  // Svinn
  waste: {
    list: (from?: string, to?: string) =>
      http<WasteRecord[]>(
        `/waste${from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ""}`,
      ),
    create: (payload: {
      medicineId: string;
      amount: number;
      amountUnit?: string;
      note?: string;
    }) => http<WasteRecord>("/waste", { method: "POST", body: payload }),
    update: (
      id: string,
      patch: { amount?: number; amountUnit?: string; note?: string },
    ) =>
      http(`/waste/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: patch,
      }),
    reverse: (id: string, reason: string) =>
      http(`/waste/${encodeURIComponent(id)}/reverse`, {
        method: "POST",
        body: { reason },
      }),
    unreverse: (id: string, reason: string) =>
      http(`/waste/${encodeURIComponent(id)}/unreverse`, {
        method: "POST",
        body: { reason },
      }),
  },

  // Leveranser
  deliveries: {
    list: (from?: string, to?: string) =>
      http<DeliveryReceipt[]>(
        `/deliveries${from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ""}`,
      ),
    updateItem: (
      deliveryId: string,
      itemId: string,
      patch: {
        quantity?: number;
        batchNumber?: string;
        expirationDate?: string;
      },
    ) =>
      http(
        `/deliveries/${encodeURIComponent(deliveryId)}/items/${encodeURIComponent(itemId)}`,
        { method: "PUT", body: patch },
      ),
    updateDeviation: (
      deliveryId: string,
      deviationId: string,
      patch: { description?: string; type?: string },
    ) =>
      http(
        `/deliveries/${encodeURIComponent(deliveryId)}/deviations/${encodeURIComponent(deviationId)}`,
        { method: "PUT", body: patch },
      ),
  },

  // Varsler
  alerts: {
    list: () => http<Alert[]>("/alerts"),
    resolve: (id: string) => http(`/alerts/${id}/resolve`, { method: "POST" }),
    escalate: (id: string) =>
      http(`/alerts/${id}/escalate`, { method: "POST" }),
    unresolve: (id: string) =>
      http(`/alerts/${id}/unresolve`, { method: "POST" }),
    deescalate: (id: string) =>
      http(`/alerts/${id}/deescalate`, { method: "POST" }),
  },

  // Action-log
  logs: {
    list: (from?: string, to?: string) =>
      http<ActionLog[]>(
        `/logs${from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ""}`,
      ),
  },

  // Innstillinger
  config: {
    get: () => http<RemoteConfig>("/config"),
    update: (patch: Partial<RemoteConfig>) =>
      http<RemoteConfig>("/config", { method: "PUT", body: patch }),
  },

  // Backup / eksport (server-side)
  backup: {
    triggerFullPdf: (from: string, to: string) =>
      http<{ url: string }>("/backup/pdf", {
        method: "POST",
        body: { from, to },
      }),
  },
};

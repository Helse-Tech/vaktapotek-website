// /src/storage.ts
//
// Lett wrapper rundt localStorage + en helt enkelt versjonshåndtering.
// Token-en lagres IKKE her — den lever i en HttpOnly-cookie satt av
// WordPress-mellomvaren. Bare ikke-sensitive ting persisteres her.

const NS = "vp_admin_v1";
const k = (key: string) => `${NS}:${key}`;

export const Storage = {
  get<T = unknown>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(k(key));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(k(key), JSON.stringify(value));
    } catch {}
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(k(key));
    } catch {}
  },
  clearNamespace(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(NS + ":")) keys.push(key);
      }
      keys.forEach((kk) => window.localStorage.removeItem(kk));
    } catch {}
  },
};

export const Keys = {
  themeMode: "themeMode",
  sidebarCollapsed: "sidebarCollapsed",
  language: "language",
  lastVisitedRoute: "lastVisitedRoute",
  rangePreference: "rangePreference",
  searchHistory: "searchHistory",
  inventoryColumns: "inventoryColumns",
} as const;

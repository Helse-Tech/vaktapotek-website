// /src/components.tsx
//
// Alle gjenbrukbare komponenter samlet i én fil — bruker theme.ts og
// Tailwind-tokens. Ingen hard-kodede farger eller fonter.

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Pill,
  Printer,
  Search,
  Settings as SettingsIcon,
  Sun,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { cn, feedback, initialsOf, roleLabel } from "./helpers";
import { useApp } from "./store";
import { RESEPT_BADGE, ROLE_BADGE } from "./theme";
import type { ReseptgruppeType, UserRole } from "./types";

// ─────────────────────────────────────────────────────────────────
//  Ventral-logo (SVG inline — alltid skarp, ingen ekstern fil)
// ─────────────────────────────────────────────────────────────────
export const VentralLogo = memo(function VentralLogo({
  size = 28,
  withWordmark = true,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src="/favicon.png"
        alt="Ventral logo"
        width={size}
        height={size}
        className="rounded-xl object-cover"
      />

      {withWordmark && (
        <div className="leading-tight">
          <div className="font-semibold tracking-tight text-text">Ventral</div>
          <div className="text-captionSmall text-muted -mt-0.5">VaktApotek</div>
        </div>
      )}
    </div>
  );
});

VentralLogo.displayName = "VentralLogo";

// ─────────────────────────────────────────────────────────────────
//  Icon-wrapper (kun lucide)
// ─────────────────────────────────────────────────────────────────
export const Icon = memo(function Icon({
  icon: I,
  size = 18,
  className,
  "aria-label": ariaLabel,
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <I
      size={size}
      strokeWidth={2}
      className={cn("shrink-0", className)}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
    />
  );
});
Icon.displayName = "Icon";

// ─────────────────────────────────────────────────────────────────
//  Knapp
// ─────────────────────────────────────────────────────────────────
type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "subtle";

type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold " +
  "transition-[transform,box-shadow,background-color,color] duration-150 " +
  "active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-primary select-none whitespace-nowrap";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover shadow-sm hover:shadow-md",
  secondary:
    "bg-elevated text-text border border-border hover:bg-pressed shadow-sm",
  outline: "border border-border bg-transparent text-text hover:bg-pressed",
  ghost: "bg-transparent text-text hover:bg-pressed",
  danger: "bg-danger text-white hover:opacity-90 shadow-sm hover:shadow-md",
  subtle: "bg-primary-soft text-primary hover:brightness-95",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-buttonSmall",
  md: "h-11 px-4 text-button",
  lg: "h-12 px-5 text-button",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading,
      iconLeft,
      iconRight,
      fullWidth,
      disabled,
      onClick,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        onClick={(e) => {
          if (!disabled && !loading) {
            feedback("success");
            onClick?.(e);
          }
        }}
        className={cn(
          buttonBase,
          buttonVariants[variant],
          buttonSizes[size],
          fullWidth && "w-full",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : iconLeft ? (
          <Icon icon={iconLeft} size={16} />
        ) : null}
        <span>{children}</span>
        {!loading && iconRight ? <Icon icon={iconRight} size={16} /> : null}
      </button>
    );
  },
);
Button.displayName = "Button";

// ─────────────────────────────────────────────────────────────────
//  Card
// ─────────────────────────────────────────────────────────────────
export const Card = memo(function Card({
  children,
  className,
  onPress,
  padded = true,
  hoverable,
}: {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  padded?: boolean;
  hoverable?: boolean;
}) {
  const interactive = !!onPress;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onPress}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress?.();
        }
      }}
      className={cn(
        "bg-elevated border border-border rounded-lg shadow-sm print-card",
        padded && "p-5",
        interactive &&
          "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.997]",
        hoverable && "hover:shadow-md transition-shadow",
        className,
      )}
    >
      {children}
    </div>
  );
});
Card.displayName = "Card";

// ─────────────────────────────────────────────────────────────────
//  Section header
// ─────────────────────────────────────────────────────────────────
export const SectionHeader = memo(function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-4", className)}>
      <div>
        <h2 className="text-h2 text-text">{title}</h2>
        {subtitle && <p className="text-body text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
});
SectionHeader.displayName = "SectionHeader";

// ─────────────────────────────────────────────────────────────────
//  Divider
// ─────────────────────────────────────────────────────────────────
export const Divider = memo(function Divider({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("h-px bg-divider", className)} />;
});
Divider.displayName = "Divider";

// ─────────────────────────────────────────────────────────────────
//  Input (label + error)
// ─────────────────────────────────────────────────────────────────
interface InputProps extends ComponentPropsWithoutRef<"input"> {
  label?: string;
  error?: string;
  hint?: string;
  iconLeft?: LucideIcon;
  rightSlot?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    hint,
    iconLeft,
    rightSlot,
    className,
    containerClassName,
    ...rest
  },
  ref,
) {
  const id = useMemo(
    () => rest.id ?? `inp_${Math.random().toString(36).slice(2, 9)}`,
    [rest.id],
  );
  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label && (
        <label htmlFor={id} className="text-label font-medium text-text">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border bg-surface px-3 h-11 transition-colors",
          "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15",
          error ? "border-danger" : "border-border",
        )}
      >
        {iconLeft && <Icon icon={iconLeft} className="text-muted" />}
        <input
          ref={ref}
          id={id}
          {...rest}
          className={cn(
            "flex-1 bg-transparent text-body text-text placeholder:text-subtle outline-none",
            className,
          )}
        />
        {rightSlot}
      </div>
      {error ? (
        <p className="text-caption text-danger flex items-center gap-1">
          <Icon icon={AlertCircle} size={14} />
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-muted">{hint}</p>
      ) : null}
    </div>
  );
});
Input.displayName = "Input";

// ─────────────────────────────────────────────────────────────────
//  Passord-input m/ eye-toggle
// ─────────────────────────────────────────────────────────────────
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  function PasswordInput(props, ref) {
    const [show, setShow] = useState(false);
    return (
      <Input
        ref={ref}
        type={show ? "text" : "password"}
        autoComplete="current-password"
        rightSlot={
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="p-1 rounded text-muted hover:text-text focus-visible:outline-2"
            aria-label={show ? "Skjul passord" : "Vis passord"}
          >
            <Icon icon={show ? EyeOff : Eye} size={18} />
          </button>
        }
        {...props}
      />
    );
  },
);
PasswordInput.displayName = "PasswordInput";

// ─────────────────────────────────────────────────────────────────
//  Search-bar
// ─────────────────────────────────────────────────────────────────
export const SearchBar = memo(function SearchBar({
  value,
  onChange,
  placeholder = "Søk…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      iconLeft={Search}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      containerClassName={className}
      rightSlot={
        value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-1 text-muted hover:text-text"
            aria-label="Tøm søk"
          >
            <Icon icon={X} size={16} />
          </button>
        ) : null
      }
    />
  );
});
SearchBar.displayName = "SearchBar";

// ─────────────────────────────────────────────────────────────────
//  Chip / Badge
// ─────────────────────────────────────────────────────────────────
export const Chip = memo(function Chip({
  children,
  variant = "neutral",
  size = "md",
  icon,
  onPress,
  className,
}: {
  children: ReactNode;
  variant?:
    | "neutral"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "accent";
  size?: "sm" | "md";
  icon?: LucideIcon;
  onPress?: () => void;
  className?: string;
}) {
  const colors: Record<string, string> = {
    neutral: "bg-pressed text-muted",
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
    accent: "bg-accent-soft text-accent",
  };
  const sizes =
    size === "sm" ? "h-6 px-2 text-captionSmall" : "h-7 px-2.5 text-caption";
  return (
    <span
      onClick={onPress}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        colors[variant],
        sizes,
        onPress && "cursor-pointer",
        className,
      )}
    >
      {icon && <Icon icon={icon} size={size === "sm" ? 12 : 14} />}
      {children}
    </span>
  );
});
Chip.displayName = "Chip";

export const RoleBadge = memo(function RoleBadge({ role }: { role: UserRole }) {
  const c = ROLE_BADGE[role] ?? ROLE_BADGE.c_prep;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 h-6 text-captionSmall font-semibold",
        c.bg,
        c.fg,
      )}
    >
      {roleLabel(role)}
    </span>
  );
});
RoleBadge.displayName = "RoleBadge";

export const ReseptBadge = memo(function ReseptBadge({
  group,
}: {
  group?: ReseptgruppeType;
}) {
  if (!group) return null;
  const c = RESEPT_BADGE[group];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 h-5 text-captionSmall font-bold",
        c.bg,
        c.fg,
      )}
      title={`Resept-gruppe ${group}`}
    >
      {group}
    </span>
  );
});
ReseptBadge.displayName = "ReseptBadge";

// ─────────────────────────────────────────────────────────────────
//  Empty state
// ─────────────────────────────────────────────────────────────────
export const EmptyState = memo(function EmptyState({
  icon: I = Pill,
  title,
  subtitle,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-16 h-16 rounded-full bg-primary-soft flex items-center justify-center mb-4">
        <Icon icon={I} size={28} className="text-primary" />
      </div>
      <h3 className="text-h3 text-text mb-1">{title}</h3>
      {subtitle && <p className="text-body text-muted max-w-md">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
});
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────
//  Skeleton
// ─────────────────────────────────────────────────────────────────
export const Skeleton = memo(function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("shimmer rounded-md h-4 w-full", className)} />;
});
Skeleton.displayName = "Skeleton";

export const SkeletonRows = memo(function SkeletonRows({
  rows = 6,
}: {
  rows?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
});
SkeletonRows.displayName = "SkeletonRows";

// ─────────────────────────────────────────────────────────────────
//  Loader
// ─────────────────────────────────────────────────────────────────
export const Loader = memo(function Loader({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-muted">
      <Loader2 size={20} className="animate-spin" />
      {label && <span className="text-body">{label}</span>}
    </div>
  );
});
Loader.displayName = "Loader";

// ─────────────────────────────────────────────────────────────────
//  Modal
// ─────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
}) {
  const sizeClass: Record<string, string> = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[rgb(0_0_0/0.55)] backdrop-blur-sm animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101]",
            "w-[calc(100vw-32px)]",
            sizeClass[size],
            "bg-elevated border border-border rounded-xl shadow-xl animate-slide-up",
            "max-h-[calc(100vh-64px)] overflow-hidden flex flex-col",
          )}
        >
          {(title || description) && (
            <div className="px-6 py-5 border-b border-border">
              {title && (
                <Dialog.Title className="text-h3 text-text">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description className="text-body text-muted mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
          )}
          <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
          {footer && (
            <div className="px-6 py-4 border-t border-border bg-surface flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
          <Dialog.Close asChild>
            <button
              aria-label="Lukk"
              className="absolute top-4 right-4 p-1.5 rounded-md text-muted hover:bg-pressed hover:text-text"
            >
              <Icon icon={X} size={18} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Confirm dialog (global)
// ─────────────────────────────────────────────────────────────────
export function GlobalConfirmDialog() {
  const c = useApp((s) => s.confirm);
  const close = useApp((s) => s.closeConfirm);
  const [busy, setBusy] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!c.onConfirm) {
      close();
      return;
    }
    setBusy(true);
    try {
      await c.onConfirm();
    } finally {
      setBusy(false);
      close();
    }
  }, [c, close]);

  return (
    <Modal
      open={c.open}
      onClose={close}
      title={c.title}
      description={c.message}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            {c.cancelLabel ?? "Avbryt"}
          </Button>
          <Button
            variant={c.danger ? "danger" : "primary"}
            loading={busy}
            onClick={handleConfirm}
          >
            {c.confirmLabel ?? "Bekreft"}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            c.danger
              ? "bg-danger-soft text-danger"
              : "bg-primary-soft text-primary",
          )}
        >
          <Icon icon={c.danger ? AlertTriangle : Info} size={20} />
        </div>
        <p className="text-body text-muted">{c.message}</p>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Help-tooltip ("?" som forklarer noe)
// ─────────────────────────────────────────────────────────────────
export const HelpTip = memo(function HelpTip({
  text,
  side = "top",
}: {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip.Provider delayDuration={120}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label="Mer informasjon"
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted hover:text-primary"
          >
            <Icon icon={HelpCircle} size={16} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            className="z-[200] max-w-xs rounded-md bg-text px-3 py-2 text-caption text-inverse shadow-lg"
          >
            {text}
            <Tooltip.Arrow className="fill-text" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
});
HelpTip.displayName = "HelpTip";

// ─────────────────────────────────────────────────────────────────
//  Avatar (initialer)
// ─────────────────────────────────────────────────────────────────
export const Avatar = memo(function Avatar({
  name,
  size = 36,
}: {
  name?: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-full bg-primary-soft text-primary flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initialsOf(name)}
    </div>
  );
});
Avatar.displayName = "Avatar";

// ─────────────────────────────────────────────────────────────────
//  Sidebar / app-layout
// ─────────────────────────────────────────────────────────────────
import {
  Activity,
  BarChart3,
  Bell,
  ClipboardList,
  FileText,
  Home,
  Package,
  ShoppingCart,
  Trash2,
  Users,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Oversikt", icon: Home },
  { to: "/inventory", label: "Lager", icon: Package },
  { to: "/order-list", label: "Bestillingsliste", icon: ShoppingCart },
  { to: "/dispensings", label: "Uttak", icon: ClipboardList },
  { to: "/waste", label: "Svinn", icon: Trash2 },
  { to: "/deliveries", label: "Leveranser", icon: Package },
  { to: "/alerts", label: "Varsler", icon: Bell },
  { to: "/employees", label: "Ansatte", icon: Users },
  { to: "/reports", label: "Rapporter", icon: BarChart3 },
  { to: "/audit-log", label: "Revisjonslogg", icon: Activity },
  { to: "/settings", label: "Innstillinger", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useApp((s) => s.sidebarCollapsed);
  const setCollapsed = useApp((s) => s.setSidebarCollapsed);
  const session = useApp((s) => s.session);
  const setPalette = useApp((s) => s.setPaletteOpen);
  const themeMode = useApp((s) => s.themeMode);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const navigate = useNavigate();

  // Keyboard shortcut: Cmd/Ctrl+K for command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPalette, toggleTheme]);

  return (
    <div className="min-h-screen bg-bg text-text flex">
      <aside
        className={cn(
          "no-print sticky top-0 self-start h-screen border-r border-border bg-surface flex flex-col",
          "transition-[width] duration-200 ease-out",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        <div className="px-4 h-16 flex items-center justify-between border-b border-border">
          {collapsed ? (
            <VentralLogo size={28} withWordmark={false} />
          ) : (
            <Link to="/" className="flex items-center">
              <VentralLogo size={30} />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-muted hover:bg-pressed hover:text-text"
            aria-label={collapsed ? "Utvid meny" : "Slå sammen meny"}
          >
            <Icon icon={Menu} size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-body font-medium",
                  "hover:bg-pressed transition-colors",
                  isActive
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:text-text",
                )
              }
            >
              <Icon icon={n.icon} size={18} />
              {!collapsed && <span>{n.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="w-full flex items-center gap-3 rounded-md p-2 hover:bg-pressed">
                <Avatar name={session?.user?.name} size={36} />
                {!collapsed && (
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="text-bodyMedium text-text truncate">
                      {session?.user?.name ?? "Bruker"}
                    </div>
                    <div className="text-captionSmall text-muted truncate">
                      {session?.tenant?.name ?? "—"}
                    </div>
                  </div>
                )}
                {!collapsed && (
                  <Icon icon={ChevronDown} size={14} className="text-muted" />
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={6}
                className="z-[120] w-56 rounded-md border border-border bg-elevated shadow-lg p-1.5"
              >
                <DropdownMenu.Item
                  onSelect={() => navigate("/settings")}
                  className="cursor-pointer rounded-md px-3 py-2 text-body text-text outline-none flex items-center gap-2 hover:bg-pressed"
                >
                  <Icon icon={SettingsIcon} size={16} /> Innstillinger
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => toggleTheme()}
                  className="cursor-pointer rounded-md px-3 py-2 text-body text-text outline-none flex items-center gap-2 hover:bg-pressed"
                >
                  <Icon icon={themeMode === "dark" ? Sun : Moon} size={16} />
                  {themeMode === "dark" ? "Lyst tema" : "Mørkt tema"}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px my-1 bg-divider" />
                <DropdownMenu.Item
                  onSelect={async () => {
                    await import("./api").then((m) => m.auth.logout());
                    window.location.href = "/login";
                  }}
                  className="cursor-pointer rounded-md px-3 py-2 text-body text-danger outline-none flex items-center gap-2 hover:bg-danger-soft"
                >
                  <Icon icon={LogOut} size={16} /> Logg ut
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <TopBar />
        <div className="px-6 py-6 max-w-[1440px] mx-auto">{children}</div>
      </main>
    </div>
  );
}

function TopBar() {
  const setPalette = useApp((s) => s.setPaletteOpen);
  const themeMode = useApp((s) => s.themeMode);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const session = useApp((s) => s.session);
  const location = useLocation();

  const crumb = useMemo(() => {
    const found = NAV.find(
      (n) =>
        n.to === location.pathname || location.pathname.startsWith(n.to + "/"),
    );
    return found?.label ?? "Side";
  }, [location.pathname]);

  return (
    <header className="app-header no-print sticky top-0 z-50 bg-surface/80 backdrop-blur border-b border-border">
      <div className="flex items-center gap-3 h-16 px-6 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-2 text-muted text-caption">
          <span>{session?.tenant?.name ?? "—"}</span>
          <Icon icon={ChevronRight} size={14} />
          <span className="text-text font-semibold">{crumb}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPalette(true)}
            className="hidden md:flex items-center gap-2 h-9 rounded-md border border-border bg-surface px-3 text-muted hover:text-text hover:bg-pressed transition-colors"
            aria-label="Søk overalt"
            title="Søk (Cmd/Ctrl + K)"
          >
            <Icon icon={Search} size={16} />
            <span className="text-caption">Søk…</span>
            <kbd className="ml-3 hidden md:inline-flex items-center rounded border border-border bg-bg px-1.5 py-0.5 text-captionSmall text-muted">
              ⌘K
            </kbd>
          </button>
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-md border border-border bg-surface text-muted hover:text-text hover:bg-pressed flex items-center justify-center"
            aria-label="Bytt tema"
          >
            <Icon icon={themeMode === "dark" ? Sun : Moon} size={18} />
          </button>
          <button
            onClick={() => window.print()}
            className="h-9 w-9 rounded-md border border-border bg-surface text-muted hover:text-text hover:bg-pressed flex items-center justify-center"
            aria-label="Skriv ut"
            title="Skriv ut (Ctrl/Cmd + P)"
          >
            <Icon icon={Printer} size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Command palette (Cmd/Ctrl+K)
// ─────────────────────────────────────────────────────────────────
export function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const setOpen = useApp((s) => s.setPaletteOpen);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return NAV.slice();
    return NAV.filter((n) => n.label.toLowerCase().includes(term));
  }, [q]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <Modal open={open} onClose={() => setOpen(false)} size="md">
      <div className="-mx-6 -my-5">
        <div className="px-4 py-3 pr-14 border-b border-border flex items-center gap-2">
          <Icon icon={Search} size={18} className="text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk i menyen, gå til side…"
            className="flex-1 bg-transparent outline-none text-body text-text placeholder:text-subtle"
          />
          <kbd className="text-captionSmall text-muted border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {results.map((r) => (
            <li key={r.to}>
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-pressed text-body text-text"
                onClick={() => {
                  navigate(r.to);
                  setOpen(false);
                }}
              >
                <Icon icon={r.icon} size={16} className="text-muted" />
                {r.label}
                <Icon
                  icon={ChevronRight}
                  size={14}
                  className="ml-auto text-subtle"
                />
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-4 py-6 text-caption text-muted text-center">
              Ingen treff for «{q}»
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Stat-kort
// ─────────────────────────────────────────────────────────────────
export const StatCard = memo(function StatCard({
  label,
  value,
  delta,
  icon,
  tone = "primary",
  helpText,
}: {
  label: string;
  value: string | number;
  delta?: { value: number; suffix?: string; positive?: boolean };
  icon?: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger" | "accent" | "info";
  helpText?: string;
}) {
  const ring: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    accent: "bg-accent-soft text-accent",
    info: "bg-info-soft text-info",
  };
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-caption text-muted">{label}</span>
            {helpText && <HelpTip text={helpText} />}
          </div>
          <div className="text-h1 text-text font-bold tabular-nums">
            {value}
          </div>
          {delta && (
            <div
              className={cn(
                "text-caption flex items-center gap-1",
                delta.positive ? "text-success" : "text-muted",
              )}
            >
              {delta.value > 0 ? "+" : ""}
              {delta.value}
              {delta.suffix ?? ""}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "w-11 h-11 rounded-md flex items-center justify-center",
              ring[tone],
            )}
          >
            <Icon icon={icon} size={20} />
          </div>
        )}
      </div>
    </Card>
  );
});
StatCard.displayName = "StatCard";

// ─────────────────────────────────────────────────────────────────
//  Tabell (responsiv, sortérbar)
// ─────────────────────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  width?: string;
  align?: "left" | "right" | "center";
  noPrint?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  emptyTitle = "Ingen data",
  emptySubtitle,
  onRowClick,
  pageSize = 25,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptySubtitle?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === "number" && typeof vb === "number")
        return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "nb") * dir;
    });
  }, [rows, columns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-body">
          <thead className="bg-surface border-b border-border">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-left text-label text-muted font-semibold whitespace-nowrap",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.noPrint && "no-print",
                    c.sortValue && "cursor-pointer select-none",
                  )}
                  style={c.width ? { width: c.width } : undefined}
                  onClick={() => {
                    if (!c.sortValue) return;
                    if (sortKey === c.key) {
                      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                    } else {
                      setSortKey(c.key);
                      setSortDir("asc");
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sortKey === c.key && (
                      <Icon
                        icon={ChevronDown}
                        size={12}
                        className={cn(
                          "transition-transform",
                          sortDir === "asc" && "rotate-180",
                        )}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, idx) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-divider last:border-b-0",
                  idx % 2 === 1 && "bg-surface/40",
                  onRowClick && "cursor-pointer hover:bg-pressed",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3 text-text align-middle",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.noPrint && "no-print",
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface/40 no-print">
          <span className="text-caption text-muted">
            Side {safePage} av {totalPages} ({sorted.length} rader)
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Forrige
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Neste
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Range-velger
// ─────────────────────────────────────────────────────────────────
import type { DateRangePreset } from "./types";
import { buildRange, rangeLabel } from "./helpers";

const RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "I dag" },
  { value: "yesterday", label: "I går" },
  { value: "last_7", label: "Siste 7 dager" },
  { value: "last_30", label: "Siste 30 dager" },
  { value: "this_week", label: "Denne uken" },
  { value: "last_week", label: "Forrige uke" },
  { value: "this_month", label: "Denne måneden" },
  { value: "last_month", label: "Forrige måned" },
  { value: "this_quarter", label: "Dette kvartalet" },
  { value: "this_year", label: "I år" },
  { value: "all", label: "Alt" },
];

export function RangePicker() {
  const range = useApp((s) => s.range);
  const setRange = useApp((s) => s.setRange);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="h-10 px-4 rounded-md border border-border bg-surface text-body text-text hover:bg-pressed inline-flex items-center gap-2"
          aria-label="Velg tidsperiode"
        >
          <Icon icon={ClipboardList} size={16} className="text-muted" />
          {rangeLabel(range)}
          <Icon icon={ChevronDown} size={14} className="text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[120] w-60 rounded-md border border-border bg-elevated shadow-lg p-2 animate-fade-in"
        >
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setRange(buildRange(p.value))}
              className={cn(
                "w-full text-left rounded-md px-3 py-2 text-body hover:bg-pressed",
                range.preset === p.value
                  ? "bg-primary-soft text-primary font-semibold"
                  : "text-text",
              )}
            >
              {p.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Liten "page header" m/ tilbake-knapp
// ─────────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  back = false,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between gap-4 mb-6 no-print">
      <div className="flex items-center gap-3 min-w-0">
        {back && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Tilbake"
            className="h-9 w-9 rounded-md border border-border bg-surface text-muted hover:text-text hover:bg-pressed flex items-center justify-center"
          >
            <Icon icon={ArrowLeft} size={18} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-h1 text-text truncate">{title}</h1>
          {subtitle && (
            <p className="text-body text-muted truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Status-pille (success / warning / danger / info)
// ─────────────────────────────────────────────────────────────────
export const StatusPill = memo(function StatusPill({
  tone,
  children,
  icon,
}: {
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  children: ReactNode;
  icon?: LucideIcon;
}) {
  const map: Record<
    string,
    { bg: string; fg: string; iconColor: string; defaultIcon: LucideIcon }
  > = {
    success: {
      bg: "bg-success-soft",
      fg: "text-success",
      iconColor: "text-success",
      defaultIcon: CheckCircle2,
    },
    warning: {
      bg: "bg-warning-soft",
      fg: "text-warning",
      iconColor: "text-warning",
      defaultIcon: AlertTriangle,
    },
    danger: {
      bg: "bg-danger-soft",
      fg: "text-danger",
      iconColor: "text-danger",
      defaultIcon: XCircle,
    },
    info: {
      bg: "bg-info-soft",
      fg: "text-info",
      iconColor: "text-info",
      defaultIcon: Info,
    },
    neutral: {
      bg: "bg-pressed",
      fg: "text-muted",
      iconColor: "text-muted",
      defaultIcon: Info,
    },
  };
  const s = map[tone];
  const I = icon ?? s.defaultIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-caption font-medium",
        s.bg,
        s.fg,
      )}
    >
      <Icon icon={I} size={12} />
      {children}
    </span>
  );
});
StatusPill.displayName = "StatusPill";

// ─────────────────────────────────────────────────────────────────
//  Toast (sonner-wrapper – brukes globalt fra App.tsx)
// ─────────────────────────────────────────────────────────────────
// Toast-funksjoner eksporteres direkte fra sonner i App.tsx — vi
// trenger ingen wrapper her.

// ─────────────────────────────────────────────────────────────────
//  Bruker-listeitem (kompakt)
// ─────────────────────────────────────────────────────────────────
export const UserRow = memo(function UserRow({
  name,
  empNum,
  role,
  active,
  onPress,
}: {
  name: string;
  empNum: string;
  role: UserRole;
  active: boolean;
  onPress?: () => void;
}) {
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-pressed text-left"
    >
      <Avatar name={name} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-bodyMedium text-text truncate">
          {name}
          {!active && (
            <span className="ml-2 text-caption text-muted">(inaktiv)</span>
          )}
        </div>
        <div className="text-caption text-muted">#{empNum}</div>
      </div>
      <RoleBadge role={role} />
    </button>
  );
});
UserRow.displayName = "UserRow";

// ─────────────────────────────────────────────────────────────────
//  Hjelpe-export
// ─────────────────────────────────────────────────────────────────
export {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Package,
  Pill,
  Printer,
  Trash2,
  Users,
};

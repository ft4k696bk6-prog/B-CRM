import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const alertToneClasses: Record<Tone, string> = {
  default: "border-line bg-white text-ink",
  success: "border-leaf/20 bg-leaf/10 text-leaf",
  warning: "border-warn/25 bg-warn/10 text-warn",
  danger: "border-danger/20 bg-danger/10 text-danger",
  info: "border-sky/20 bg-sky/10 text-sky"
};

const alertIcons: Record<Tone, LucideIcon> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  danger: AlertCircle,
  info: Info
};

export function Surface({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cx("app-card", className)}>{children}</section>;
}

export function Alert({
  tone = "info",
  title,
  children,
  className = ""
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const Icon = alertIcons[tone];

  return (
    <div className={cx("flex gap-3 rounded-lg border p-3 text-sm font-semibold", alertToneClasses[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <div className="mb-1 font-black text-ink">{title}</div> : null}
        <div className="leading-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className = ""
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-lg border border-dashed border-line bg-[#f8fafc] px-4 py-8 text-center", className)}>
      <div className="text-sm font-black text-ink">{title}</div>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className = ""
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="section-title">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  icon: Icon,
  title,
  description,
  actions,
  tone = "sky",
  className = ""
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: "sky" | "leaf" | "solar" | "danger" | "warn" | "ink";
  className?: string;
}) {
  const toneClass = {
    sky: "bg-sky/10 text-sky",
    leaf: "bg-leaf/10 text-leaf",
    solar: "bg-solar/15 text-[#8a5a00]",
    danger: "bg-danger/10 text-danger",
    warn: "bg-warn/10 text-warn",
    ink: "bg-ink text-white"
  }[tone];

  return (
    <div className={cx("mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className={cx("app-icon", toneClass)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-black text-ink">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

export function ModalShell({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  size = "md"
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;

  const sizeClass = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl"
  }[size];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#101722]/70 px-3 py-4 backdrop-blur-sm sm:px-4">
      <section className={cx("max-h-[92vh] w-full overflow-hidden rounded-lg border border-line bg-white shadow-soft", sizeClass)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Zamknij">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-132px)] overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? <div className="border-t border-line px-4 py-3 sm:px-5">{footer}</div> : null}
      </section>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Anuluj",
  tone = "danger",
  busy = false,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmClass = tone === "danger" ? "btn-danger" : tone === "warning" ? "btn-primary" : "btn-primary";

  return (
    <ModalShell
      open={open}
      title={title}
      size="sm"
      onClose={busy ? () => undefined : onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={confirmClass}>
            {busy ? "Przetwarzanie" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-sm leading-6 text-muted">{description}</div>
    </ModalShell>
  );
}

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useEffect } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type Tone = "brand" | "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  brand: "border-[var(--bb-blaze-soft)] bg-[var(--bb-blaze-soft)] text-[var(--bb-charcoal)]",
  neutral: "border-[var(--bb-line)] bg-[var(--bb-surface-warm)] text-[var(--bb-muted)]",
  success: "border-[var(--bb-success-soft)] bg-[var(--bb-success-soft)] text-[var(--bb-success-strong)]",
  warning: "border-[var(--bb-warning-soft)] bg-[var(--bb-warning-soft)] text-[var(--bb-warning-strong)]",
  danger: "border-[var(--bb-danger-soft)] bg-[var(--bb-danger-soft)] text-[var(--bb-danger-strong)]",
  info: "border-[var(--bb-info-soft)] bg-[var(--bb-info-soft)] text-[var(--bb-info-strong)]",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bb-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  loading?: boolean;
  size?: "sm" | "md" | "lg" | "icon";
  variant?: "primary" | "secondary" | "danger" | "ghost" | "quiet";
};

export function Button({
  children,
  className,
  disabled,
  fullWidth,
  loading,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const variantClass = {
    primary:
      "border-transparent bg-[var(--bb-blaze)] text-white shadow-[var(--bb-shadow-action)] hover:bg-[var(--bb-blaze-strong)]",
    secondary:
      "border-[var(--bb-line)] bg-white text-[var(--bb-charcoal)] shadow-[var(--bb-shadow-soft)] hover:border-[var(--bb-blaze)]",
    danger:
      "border-[var(--bb-danger-soft)] bg-[var(--bb-danger-soft)] text-[var(--bb-danger-strong)] hover:border-[var(--bb-danger)]",
    ghost:
      "border-transparent bg-transparent text-[var(--bb-charcoal)] hover:bg-[var(--bb-surface-warm)]",
    quiet:
      "border-[var(--bb-line)] bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)] hover:border-[var(--bb-blaze)]",
  }[variant];
  const sizeClass = {
    sm: "min-h-11 rounded-2xl px-4 text-sm",
    md: "min-h-14 rounded-2xl px-5 text-base",
    lg: "min-h-16 rounded-[24px] px-6 text-lg",
    icon: "size-12 rounded-full p-0",
  }[size];

  return (
    <button
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 border font-black transition disabled:cursor-not-allowed disabled:opacity-60",
        focusRing,
        variantClass,
        sizeClass,
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "div" | "section";
  elevated?: boolean;
  interactive?: boolean;
  tone?: "default" | "dark" | "warm";
};

export function Card({
  as = "section",
  children,
  className,
  elevated = false,
  interactive = false,
  tone = "default",
  ...props
}: CardProps) {
  const Component = as;
  const toneClass = {
    default: "border-[var(--bb-line)] bg-white text-[var(--bb-charcoal)]",
    dark: "border-transparent bg-[var(--bb-charcoal)] text-white",
    warm: "border-[var(--bb-line)] bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]",
  }[tone];

  return (
    <Component
      className={cx(
        "min-w-0 overflow-hidden rounded-[var(--bb-radius-card)] border p-5",
        elevated ? "shadow-[var(--bb-shadow-card)]" : "shadow-[var(--bb-shadow-soft)]",
        interactive && "transition hover:border-[var(--bb-blaze)]",
        toneClass,
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <span
      className={cx(
        "inline-flex min-h-7 max-w-full min-w-0 items-center rounded-full border px-2.5 py-1 text-xs font-black uppercase",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  tone,
}: {
  status: ReactNode;
  tone?: Tone;
}) {
  return <Badge className="max-w-[6.5rem] shrink-0 truncate" tone={tone}>{status}</Badge>;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
  label?: string;
};

export function Input({ className, icon, label, ...props }: FieldProps) {
  return (
    <label className={cx("block min-w-0 max-w-full", className)}>
      {label ? (
        <span className="mb-2 block text-xs font-black uppercase text-[var(--bb-muted)]">
          {label}
        </span>
      ) : null}
      <span
        className={cx(
          "flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--bb-line)] bg-white px-4 shadow-[var(--bb-shadow-soft)] focus-within:border-[var(--bb-blaze)]",
          focusRing,
        )}
      >
        {icon ? <span className="shrink-0 text-[var(--bb-charcoal)]">{icon}</span> : null}
        <input
          className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold text-[var(--bb-charcoal)] outline-none placeholder:text-[var(--bb-muted)]"
          {...props}
        />
      </span>
    </label>
  );
}

export function Textarea({
  className,
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className={cx("block min-w-0 max-w-full", className)}>
      {label ? (
        <span className="mb-2 block text-xs font-black uppercase text-[var(--bb-muted)]">
          {label}
        </span>
      ) : null}
      <textarea
        className={cx(
          "min-h-32 w-full resize-none rounded-2xl border border-[var(--bb-line)] bg-white px-4 py-3 text-base font-semibold text-[var(--bb-charcoal)] outline-none placeholder:text-[var(--bb-muted)] focus:border-[var(--bb-blaze)]",
          focusRing,
        )}
        {...props}
      />
    </label>
  );
}

export function Select({
  className,
  label,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={cx("block min-w-0 max-w-full", className)}>
      {label ? (
        <span className="mb-2 block text-xs font-black uppercase text-[var(--bb-muted)]">
          {label}
        </span>
      ) : null}
      <select
        className={cx(
          "min-h-14 w-full rounded-2xl border border-[var(--bb-line)] bg-white px-4 text-base font-black text-[var(--bb-charcoal)] outline-none focus:border-[var(--bb-blaze)]",
          focusRing,
        )}
        {...props}
      />
    </label>
  );
}

export function AppShell({
  children,
  className,
  footer,
  header,
  login = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  header?: ReactNode;
  login?: boolean;
  style?: HTMLAttributes<HTMLElement>["style"];
}) {
  return (
    <main
      className={cx(
        login
          ? "flex min-h-svh w-full flex-col bg-[length:auto_80%] bg-center bg-no-repeat md:bg-[length:auto_130%]"
          : "mx-auto flex min-h-svh w-full max-w-md flex-col bg-white shadow-[var(--bb-shadow-shell)] md:my-6 md:min-h-[calc(100svh-3rem)] md:overflow-hidden md:rounded-[28px]",
        className,
      )}
      style={style}
    >
      {header}
      {children}
      {footer}
    </main>
  );
}

export function PageHeader({
  actions,
  eyebrow,
  icon,
  title,
  subtitle,
}: {
  actions?: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-2">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          {icon ? (
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]">
              {icon}
            </span>
          ) : null}
          <h2 className="text-3xl font-black leading-tight text-[var(--bb-charcoal)]">
            {title}
          </h2>
        </div>
        {subtitle ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  action,
  title,
  subtitle,
}: {
  action?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-lg font-black text-[var(--bb-charcoal)]">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-sm font-semibold text-[var(--bb-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function BottomNav({
  items,
}: {
  items: Array<{
    active: boolean;
    avatarFallback?: string;
    avatarSrc?: string;
    icon?: ReactNode;
    label: string;
    onClick: () => void;
  }>;
}) {
  return (
    <nav className="grid w-full min-w-0 grid-cols-3 items-center gap-2 overflow-hidden" aria-label="Driver navigation">
      <div aria-hidden="true" />
      {items.map((item) => (
        <div className="flex justify-center" key={item.label}>
          <Button
            aria-label={item.label}
            className={cx(
              "overflow-hidden",
              item.active
                ? "border-[var(--bb-blaze)] bg-[var(--bb-blaze-soft)] text-[var(--bb-charcoal)] shadow-[var(--bb-shadow-action)]"
                : "",
            )}
            onClick={item.onClick}
            size="icon"
            title={item.label}
            variant="quiet"
          >
            {item.avatarSrc ? (
              <img src={item.avatarSrc} alt="" className="size-full object-cover" />
            ) : item.avatarFallback ? (
              item.avatarFallback
            ) : (
              item.icon
            )}
          </Button>
        </div>
      ))}
    </nav>
  );
}

export function EmptyState({
  action,
  children,
  icon,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <Card className="grid flex-1 place-items-center text-center" elevated>
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]">
          {icon ?? <Inbox size={22} aria-hidden="true" />}
        </span>
        <p className="mt-4 text-lg font-black text-[var(--bb-charcoal)]">{title}</p>
        {children ? (
          <div className="mt-1 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </Card>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid flex-1 place-items-center py-14 text-center">
      <div>
        <Loader2 className="mx-auto size-8 animate-spin text-[var(--bb-blaze)]" />
        <p className="mt-3 text-sm font-bold text-[var(--bb-muted)]">{label}</p>
      </div>
    </div>
  );
}

export function ErrorState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "rounded-2xl border border-[var(--bb-danger-soft)] bg-[var(--bb-danger-soft)] px-4 py-3 text-sm font-bold text-[var(--bb-danger-strong)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function ConfirmDialog({
  body,
  cancelLabel = "Go Back",
  children,
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
  title,
}: {
  body?: ReactNode;
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return createPortal(
    <div className="fixed left-0 top-0 z-[9999] grid h-[100dvh] w-[100vw] place-items-center bg-black/45 px-5">
      <Card as="div" className="w-full max-w-sm" elevated>
        <h3 className="text-xl font-black text-[var(--bb-charcoal)]">{title}</h3>
        {body ? (
          <div className="mt-2 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
            {body}
          </div>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button fullWidth onClick={onCancel} size="sm" variant="secondary">
            {cancelLabel}
          </Button>
          <Button fullWidth onClick={onConfirm} size="sm">
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>,
    document.body,
  );
}

export function MetricCard({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[var(--bb-surface-warm)] px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase text-[var(--bb-muted)]">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-black text-[var(--bb-charcoal)]">
        {value}
      </p>
    </div>
  );
}

export function OrderCard({
  actions,
  current,
  icon,
  meta,
  muted,
  onClick,
  status,
  statusTone = "neutral",
  subtitle,
  title,
}: {
  actions?: ReactNode;
  current?: boolean;
  icon?: ReactNode;
  meta?: ReactNode;
  muted?: boolean;
  onClick?: () => void;
  status?: ReactNode;
  statusTone?: Tone;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  const content = (
    <>
      <div className="flex min-w-0 max-w-full items-start gap-3 overflow-hidden">
        {icon ? (
          <span
            className={cx(
              "grid size-11 shrink-0 place-items-center rounded-2xl",
              current
                ? "bg-[var(--bb-blaze)] text-white"
                : "bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]",
              muted && "bg-[var(--bb-neutral-soft)] text-[var(--bb-muted)]",
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={cx(
                  "truncate text-base font-black",
                  muted ? "text-[var(--bb-muted)]" : "text-[var(--bb-charcoal)]",
                )}
              >
                {title}
              </p>
              {subtitle ? (
                <div className="mt-1 truncate text-sm font-semibold text-[var(--bb-muted)]">
                  {subtitle}
                </div>
              ) : null}
            </div>
            {status ? <StatusBadge status={status} tone={statusTone} /> : null}
          </div>
          {meta ? <div className="mt-3">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="mt-4">{actions}</div> : null}
    </>
  );

  const cardClassName = cx(
    current && "border-[var(--bb-blaze)]",
    muted && "opacity-75",
  );

  if (onClick) {
    return (
      <button className="w-full min-w-0 overflow-hidden text-left" onClick={onClick} type="button">
        <Card as="div" className={cardClassName} interactive>
          {content}
        </Card>
      </button>
    );
  }

  return (
    <Card as="article" className={cardClassName}>
      {content}
    </Card>
  );
}

export function ActionBar({
  children,
  className,
  columns = 2,
}: {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3;
}) {
  return (
    <div className={cx("grid min-w-0 gap-2", columns === 3 ? "grid-cols-[repeat(3,minmax(0,1fr))]" : "grid-cols-[repeat(2,minmax(0,1fr))]", className)}>
      {children}
    </div>
  );
}

export function InlineNotice({
  children,
  className,
  tone = "warning",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold leading-6",
        toneClasses[tone],
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

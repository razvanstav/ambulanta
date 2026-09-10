import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "red" | "green" | "amber";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button type="button" className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={`button button-${variant}`}>
      {children}
      <Icon name="arrow" />
    </Link>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StateMessage({
  kind,
  title,
  description,
  children,
}: {
  kind: "empty" | "loading" | "error" | "waiting";
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const icons: Record<typeof kind, IconName> = {
    empty: "box",
    loading: "refresh",
    error: "warning",
    waiting: "clock",
  };
  return (
    <div
      className={`state-message state-${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-busy={kind === "loading"}
    >
      <span className="state-icon">
        <Icon name={icons[kind]} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function UnavailableAction({
  children,
  module,
  description,
}: {
  children: ReactNode;
  module: string;
  description: string;
}) {
  return (
    <div className="unavailable-action" data-planned-module={module}>
      <Button disabled>{children}</Button>
      <p>
        {description} <span>Va fi activată într-o etapă următoare.</span>
      </p>
    </div>
  );
}

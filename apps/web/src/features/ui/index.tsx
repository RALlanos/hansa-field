"use client";

import type { ReactNode } from "react";

export type NavItem = {
  id: string;
  label: string;
  group: "operaciones" | "territorio";
  icon: ReactNode;
  badge?: string | number;
};

export function StatusBadge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "info" | "danger";
}) {
  const styles: Record<string, string> = {
    default: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[variant] ?? styles.default}`}
    >
      {children}
    </span>
  );
}

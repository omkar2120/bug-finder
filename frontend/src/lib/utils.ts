import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | Date) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function formatMs(value?: number) {
  if (value == null) return "—";
  return `${Math.round(value)} ms`;
}

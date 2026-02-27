import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Capitaliza la primera letra de cada palabra (nombres de negocio, personas). */
export function capitalizeName(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

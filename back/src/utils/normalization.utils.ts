
export const removeSpaces = (value: string): string => {
  return value.replace(/\s+/g, "");
};

export const normalizeProductName = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
};

export const normalizeText = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

export const toE164Argentina = (value: string): string | null => {
  const digits = value.replace(/\D+/g, "");
  if (!digits) {
    return null;
  }

  if (digits.startsWith("54")) {
    return `+${digits}`;
  }

  let national = digits;
  if (national.startsWith("0")) {
    national = national.slice(1);
  }
  if (national.startsWith("15")) {
    national = `9${national.slice(2)}`;
  }

  return `+54${national}`;
};

export const capitalizeWords = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");
};

/** Genera un slug URL-friendly desde un nombre (minúsculas, guiones, sin acentos). */
export const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "producto";
};

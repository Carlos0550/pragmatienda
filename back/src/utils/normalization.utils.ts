export const normalizeText = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
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

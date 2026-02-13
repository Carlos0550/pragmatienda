import { randomBytes } from "crypto";

export const generateSecureString = (): string => {
  return randomBytes(6).toString("base64url").slice(0, 8);
};

export const generateTemporaryPassword = (length = 10): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += alphabet[bytes[i] % alphabet.length];
  }
  return password;
};

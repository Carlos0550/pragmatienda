import type { Request, Response } from "express";
import { env } from "../config/env";
import { generateSecureString } from "./security.utils";

export const GUEST_CART_COOKIE_NAME = "pragmatienda_guest_cart";
const GUEST_CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const parseCookieHeader = (cookieHeader?: string) => {
  if (!cookieHeader) return new Map<string, string>();
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!key) return acc;
      acc.set(key, decodeURIComponent(value));
      return acc;
    }, new Map<string, string>());
};

const buildCookie = (name: string, value: string, options?: { maxAge?: number; clear?: boolean }) => {
  const segments = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"];
  if (env.NODE_ENV === "production") {
    segments.push("Secure");
  }
  if (options?.clear) {
    segments.push("Max-Age=0");
  } else {
    segments.push(`Max-Age=${options?.maxAge ?? GUEST_CART_COOKIE_MAX_AGE_SECONDS}`);
  }
  return segments.join("; ");
};

const appendSetCookie = (res: Response, cookieValue: string) => {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }
  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current, cookieValue]);
    return;
  }
  res.setHeader("Set-Cookie", [String(current), cookieValue]);
};

export const getGuestCartTokenFromRequest = (req: Request) => {
  const cookies = parseCookieHeader(req.header("cookie"));
  return cookies.get(GUEST_CART_COOKIE_NAME) ?? null;
};

export const issueGuestCartToken = () => generateSecureString();

export const setGuestCartCookie = (res: Response, token: string) => {
  appendSetCookie(res, buildCookie(GUEST_CART_COOKIE_NAME, token));
};

export const clearGuestCartCookie = (res: Response) => {
  appendSetCookie(res, buildCookie(GUEST_CART_COOKIE_NAME, "", { clear: true }));
};

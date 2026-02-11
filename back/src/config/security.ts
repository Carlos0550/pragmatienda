import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { promisify } from "util";
import { connectRedis } from "../cache/redis";
import { env } from "./env";

const scrypt = promisify(scryptCallback);

const HASH_PREFIX = "scrypt";
const HASH_KEYLEN = 64;
const ENCRYPT_PREFIX = "aes-256-gcm";
const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 60 * 60 * 24;

export type SessionUserPayload = {
  id: string;
  email: string;
  role: number;
};

const getDefaultSecret = (): string => {
  const secret = env.SECURITY_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("SECURITY_ENCRYPTION_KEY no configurada");
  }
  return secret;
};

const deriveKey = (secret: string): Buffer => {
  return createHash("sha256").update(secret).digest();
};

export const hashString = async (value: string): Promise<string> => {
  const salt = randomBytes(16);
  const derived = (await scrypt(value, salt, HASH_KEYLEN)) as Buffer;
  return `${HASH_PREFIX}$${salt.toString("hex")}$${derived.toString("hex")}`;
};

export const verifyHash = async (value: string, stored: string): Promise<boolean> => {
  const [prefix, saltHex, hashHex] = stored.split("$");
  if (prefix !== HASH_PREFIX || !saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const hash = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(value, salt, hash.length)) as Buffer;
  return timingSafeEqual(hash, derived);
};

export const encryptString = (plain: string, secret?: string): string => {
  const key = deriveKey(secret ?? getDefaultSecret());
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPT_PREFIX}$${iv.toString("base64")}$${tag.toString(
    "base64"
  )}$${ciphertext.toString("base64")}`;
};

export const decryptString = (payload: string, secret?: string): string => {
  const [prefix, ivB64, tagB64, dataB64] = payload.split("$");
  if (prefix !== ENCRYPT_PREFIX || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Payload encriptado invalido");
  }

  const key = deriveKey(secret ?? getDefaultSecret());
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);

  return plaintext.toString("utf8");
};

export const createSessionToken = async (payload: SessionUserPayload): Promise<string> => {
  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: SESSION_TTL_SECONDS
  });
  const redis = await connectRedis();
  await redis.set(`${SESSION_PREFIX}${token}`, "1", { EX: SESSION_TTL_SECONDS });
  return token;
};

export const isSessionActive = async (token: string): Promise<boolean> => {
  if (!token) {
    return false;
  }
  const redis = await connectRedis();
  const exists = await redis.exists(`${SESSION_PREFIX}${token}`);
  return exists === 1;
};

export const verifySessionToken = (token: string): SessionUserPayload => {
  const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  const id = typeof payload.id === "string" ? payload.id : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  const role = typeof payload.role === "number" ? payload.role : Number(payload.role ?? 0);
  if (!id || !email || !role) {
    throw new Error("JWT invalido");
  }
  return { id, email, role };
};

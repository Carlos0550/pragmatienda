import "dotenv/config";
import { connectRedis, disconnectRedis } from "../cache/redis";
import { createSessionToken } from "../config/security";
import { SUPERADMIN_ROLE } from "../constants/roles";

const SUPERADMIN_ID = "superadmin";
const SUPERADMIN_EMAIL = "superadmin@system";

const getEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    console.error(`Error: ${key} es requerido. Configuralo en .env o como variable de entorno.`);
    process.exit(1);
  }
  return value;
};

const run = async () => {
  const secret = getEnv("SUPERADMIN_SECRET");

  if (secret.length < 16) {
    console.error("Error: SUPERADMIN_SECRET debe tener al menos 16 caracteres.");
    process.exit(1);
  }

  await connectRedis();

  const token = await createSessionToken({
    id: SUPERADMIN_ID,
    email: SUPERADMIN_EMAIL,
    role: SUPERADMIN_ROLE
  });

  console.log(token);
};

run()
  .catch((error) => {
    const err = error as Error;
    console.error("Error:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectRedis();
    process.exit(0);
  });

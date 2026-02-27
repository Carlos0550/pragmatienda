import { readFile } from "fs/promises";
import path from "path";
import { env } from "../config/env";
import { encryptString } from "../config/security";
import { capitalizeWords, normalizeText } from "./normalization.utils";
import dayjs from "dayjs";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const renderTemplate = async (
  templateName: string,
  variables: Record<string, string>
): Promise<string> => {
  const templatePath = path.resolve(process.cwd(), "src", "templates", templateName);
  const raw = await readFile(templatePath, "utf8");

  return Object.entries(variables).reduce((content, [key, value]) => {
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g");
    return content.replace(pattern, value);
  }, raw);
};

type WelcomeEmailUserData = {
  id: string;
  email: string;
  name: string | null;
  tenantId?: string | null;
};

type WelcomeEmailBusinessData = {
  name?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo?: string | null;
  banner?: string | null;
};

type PasswordRecoveryEmailUserData = {
  email: string;
  name: string | null;
};

export const buildWelcomeUserEmailHtml = async ({
  user,
  plainPassword,
  business
}: {
  user: WelcomeEmailUserData;
  plainPassword: string;
  business: WelcomeEmailBusinessData;
}): Promise<string> => {
  const tokenPayload = JSON.stringify({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId ?? undefined
  });
  const token = encryptString(tokenPayload);
  const backendUrl = (env.BACKEND_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, "");
  const verifyUrl = `${backendUrl}/api/public/verify?token=${encodeURIComponent(token)}`;
  const businessLogoBlock = business?.logo
    ? `<div style="margin:12px 0;"><img src="${business.logo}" alt="${business.name ?? ""}" style="max-width:100%; height:auto; border-radius:6px;" /></div>`
    : "";
  const businessBannerBlock = business?.banner
    ? `<div style="margin:12px 0;"><img src="${business.banner}" alt="${business.name ?? ""}" style="max-width:100%; height:auto; border-radius:6px;" /></div>`
    : "";

  return renderTemplate("welcome_user_business.html", {
    name: capitalizeWords(user?.name ?? ""),
    email: user.email,
    password: plainPassword,
    verifyUrl,
    businessName: capitalizeWords(business?.name ?? ""),
    businessDescription: business?.description ?? "",
    businessAddress: capitalizeWords(business?.address ?? ""),
    businessPhone: business?.phone ?? "",
    businessEmail: normalizeText(business?.email ?? "") ?? "",
    businessWebsite: business?.website ?? "",
    businessLogoBlock,
    businessBannerBlock,
    currentYear: dayjs().year().toString()
  });
};

export const buildPasswordRecoveryEmailHtml = async ({
  user,
  temporaryPassword,
  business,
  isAdminRecovery = true
}: {
  user: PasswordRecoveryEmailUserData;
  temporaryPassword: string;
  business: WelcomeEmailBusinessData;
  isAdminRecovery?: boolean;
}): Promise<string> => {
  const baseUrl = business?.website
    ? business.website.replace(/\/$/, "")
    : business?.name
      ? `https://${business.name}.pragmatienda.com`
      : env.FRONTEND_URL.replace(/\/$/, "");
  const loginPath = isAdminRecovery ? "/admin/login" : "/login";
  const loginUrl = `${baseUrl}${loginPath}`;

  return renderTemplate("password_recovery_business.html", {
    name: capitalizeWords(user.name ?? ""),
    email: user.email,
    temporaryPassword,
    loginUrl,
    businessName: capitalizeWords(business?.name ?? ""),
    currentYear: dayjs().year().toString()
  });
};

export type OrderItemForEmail = {
  productName: string;
  productImageUrl: string;
  quantity: number;
  subtotal: string;
};

export const buildOrderConfirmationBuyerHtml = async ({
  buyerName,
  orderId,
  items,
  total,
  businessName
}: {
  buyerName: string;
  orderId: string;
  items: OrderItemForEmail[];
  total: string;
  businessName: string;
}): Promise<string> => {
  const itemsList = items
    .map(
      (item) => {
        const productNameDisplay = capitalizeWords(item.productName).slice(0, 20) + "...";
        const imgBlock = item.productImageUrl
          ? `<img src="${item.productImageUrl}" alt="${productNameDisplay.replace(/"/g, "&quot;")}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; vertical-align:middle; margin-right:12px;" />`
          : "";
        return (
          `<tr style="border-bottom:1px solid #d9d9d9;">` +
          `<td style="padding:12px;">${imgBlock}${productNameDisplay}</td>` +
          `<td style="padding:12px; text-align:center;">${item.quantity}</td>` +
          `<td style="padding:12px; text-align:right;">${item.subtotal}</td>` +
          `</tr>`
        );
      }
    )
    .join("");

  return renderTemplate("order_confirmation_buyer.html", {
    buyerName: capitalizeWords(buyerName ?? ""),
    orderId,
    itemsList,
    total,
    businessName: capitalizeWords(businessName ?? ""),
    currentYear: dayjs().year().toString()
  });
};

export const buildNewOrderAdminHtml = async ({
  buyerName,
  buyerEmail,
  orderId,
  total,
  businessName
}: {
  buyerName: string;
  buyerEmail: string;
  orderId: string;
  total: string;
  businessName: string;
}): Promise<string> => {
  return renderTemplate("new_order_admin.html", {
    buyerName: capitalizeWords(buyerName ?? ""),
    buyerEmail,
    orderId,
    total,
    businessName: capitalizeWords(businessName ?? ""),
    currentYear: dayjs().year().toString()
  });
};

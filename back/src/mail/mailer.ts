import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../config/logger";

export type MailPayload = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
};

export type MailResult =
  | { provider: "resend"; id: string | null }
  | { provider: "ethereal"; messageId: string; previewUrl?: string };

type ResendRenderOptions =
  | { html: string; text?: string }
  | { text: string; html?: string };

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
let etherealTransporter: nodemailer.Transporter | null = null;

const shouldUseEthereal = () =>
  env.MAIL_PROVIDER === "ethereal" ||
  (env.NODE_ENV !== "production" && !env.RESEND_API_KEY);

const getEtherealTransporter = async () => {
  if (etherealTransporter) {
    return etherealTransporter;
  }

  const testAccount = await nodemailer.createTestAccount();
  etherealTransporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });

  logger.info("Cuenta Ethereal creada", { user: testAccount.user });
  return etherealTransporter;
};

const buildRenderOptions = (payload: MailPayload): ResendRenderOptions => {
  if (payload.html) {
    return payload.text ? { html: payload.html, text: payload.text } : { html: payload.html };
  }
  if (payload.text) {
    return { text: payload.text };
  }
  throw new Error("El correo debe incluir html o text");
};

export const sendMail = async (payload: MailPayload): Promise<MailResult> => {
  const from = payload.from ?? env.MAIL_FROM;

  if (shouldUseEthereal()) {
    const transporter = await getEtherealTransporter();
    const info = await transporter.sendMail({ ...payload, from });
    const previewUrlRaw = nodemailer.getTestMessageUrl(info);
    const previewUrl = typeof previewUrlRaw === "string" ? previewUrlRaw : undefined;

    if (previewUrl) {
      logger.info("Preview Ethereal", { previewUrl });
    }

    return {
      provider: "ethereal",
      messageId: info.messageId,
      previewUrl
    };
  }

  if (!resend) {
    throw new Error("RESEND_API_KEY no configurada");
  }

  const renderOptions = buildRenderOptions(payload);

  const { data, error } = await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    ...renderOptions
  });

  if (error) {
    logger.error("Error al enviar email con Resend", {
      message: error.message,
      name: error.name,
      from,
      to: payload.to
    });
    throw new Error(`Resend: ${error.message}`);
  }

  return { provider: "resend", id: data?.id ?? null };
};

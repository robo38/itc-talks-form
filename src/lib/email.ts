import nodemailer from "nodemailer";
import { Resend } from "resend";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return null;
  }

  return new Resend(key);
}

let transporter: nodemailer.Transporter | null = null;

function getNodemailerTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: requiredEnv("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: requiredEnv("SMTP_USER"),
      pass: requiredEnv("SMTP_PASS"),
    },
  });

  return transporter;
}

async function sendWithResend(input: SendEmailInput): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("Resend is not configured");
  }

  const from = requiredEnv("EVENT_FROM_EMAIL");

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}

async function sendWithNodemailer(input: SendEmailInput): Promise<void> {
  const from = requiredEnv("EVENT_FROM_EMAIL");
  const transport = getNodemailerTransporter();

  await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

export async function sendEmailWithFallback(input: SendEmailInput): Promise<{ provider: "resend" | "nodemailer" }> {
  try {
    await sendWithResend(input);
    return { provider: "resend" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.warn(JSON.stringify({ level: "warn", message: "Resend failed, falling back to nodemailer", reason }));
    await sendWithNodemailer(input);
    return { provider: "nodemailer" };
  }
}

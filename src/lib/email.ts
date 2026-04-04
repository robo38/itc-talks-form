import nodemailer from "nodemailer";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SendEmailResult {
  provider: "resend" | "nodemailer";
}

type EmailProvider = "smtp" | "resend";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getFromEmail(): string {
  const value = process.env.EMAIL_FROM?.trim() || process.env.EVENT_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim();
  if (!value) {
    throw new Error("Missing required environment variable: EMAIL_FROM (or EVENT_FROM_EMAIL or SMTP_USER)");
  }

  return value;
}

function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (provider === "resend") {
    return "resend";
  }

  return "smtp";
}

function getResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
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

async function sendWithNodemailer(input: SendEmailInput): Promise<void> {
  const from = getFromEmail();
  const transport = getNodemailerTransporter();

  await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

async function sendWithResend(input: SendEmailInput): Promise<void> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error("Resend is not configured");
  }

  const from = getFromEmail();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (response.ok) {
    return;
  }

  const responseBody = await response.text();
  throw new Error(`Resend request failed (${response.status}): ${responseBody.slice(0, 300)}`);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (getEmailProvider() === "resend") {
    const resendApiKey = getResendApiKey();
    if (!resendApiKey) {
      throw new Error("EMAIL_PROVIDER is set to resend but RESEND_API_KEY is missing");
    }

    try {
      await sendWithResend(input);
      return { provider: "resend" };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      console.warn(JSON.stringify({ level: "warn", message: "Resend send failed, falling back to SMTP", reason }));
    }
  }

  await sendWithNodemailer(input);
  return { provider: "nodemailer" };
}

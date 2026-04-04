import nodemailer from "nodemailer";

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

export async function sendEmail(input: SendEmailInput): Promise<{ provider: "nodemailer" }> {
  await sendWithNodemailer(input);
  return { provider: "nodemailer" };
}

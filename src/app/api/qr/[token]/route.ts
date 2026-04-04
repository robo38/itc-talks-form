import { generateQrCodePngBuffer } from "@/lib/generateQrCode";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ token: string }>;
}

function resolveAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

export async function GET(_: Request, context: Params): Promise<Response> {
  const { token } = await context.params;

  if (!token || token.trim().length < 8) {
    return new Response("Invalid token", { status: 400 });
  }

  const appBaseUrl = resolveAppBaseUrl();
  const qrValue = `${appBaseUrl.replace(/\/$/, "")}/staff/check-in?token=${encodeURIComponent(token)}`;
  const pngBuffer = await generateQrCodePngBuffer(qrValue);
  const body = new Uint8Array(pngBuffer);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400",
      "Content-Disposition": `inline; filename="ticket-${encodeURIComponent(token)}.png"`,
    },
  });
}

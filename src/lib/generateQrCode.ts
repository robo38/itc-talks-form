import QRCode from "qrcode";

export async function generateQrCodeDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
  });
}

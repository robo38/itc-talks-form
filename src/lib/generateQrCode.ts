import QRCode from "qrcode";

export async function generateQrCodeDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
  });
}

export async function generateQrCodePngBuffer(value: string): Promise<Buffer> {
  return QRCode.toBuffer(value, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
  });
}

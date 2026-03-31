import * as QRCode from 'qrcode';

/**
 * Generate a QR code data URL for an event ticket.
 * The QR encodes a verification URL with the ticket purchase ID.
 */
export async function generateTicketQR(ticketPurchaseId: string, baseUrl = 'https://spiritualcalifornia.com'): Promise<string> {
  const verifyUrl = `${baseUrl}/verify-ticket/${ticketPurchaseId}`;
  return QRCode.toDataURL(verifyUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#3A3530', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Generate a unique QR code string for storage in the database.
 */
export function generateTicketCode(ticketPurchaseId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `SC-${ticketPurchaseId.slice(-6).toUpperCase()}-${timestamp}-${random}`.toUpperCase();
}

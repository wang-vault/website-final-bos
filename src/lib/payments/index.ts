export type PaymentStatus = "pending" | "confirmed" | "failed";
export interface PaymentRequest { orderId: string; amount: number; description: string }
export interface PaymentResult { status: PaymentStatus; reference: string | null; instructions: string }
export interface PaymentProvider { readonly name: string; createPayment(request: PaymentRequest): Promise<PaymentResult> }
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual";
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    return { status: "pending", reference: request.orderId, instructions: "Hubungi WangStore melalui WhatsApp untuk memperoleh instruksi pembayaran. Status hanya berubah setelah pembayaran dikonfirmasi oleh petugas." };
  }
}
export function getPaymentProvider(): PaymentProvider { return new ManualPaymentProvider(); }

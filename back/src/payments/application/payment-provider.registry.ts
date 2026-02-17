import type { PaymentProvider } from "../domain/payment-provider";
import { PaymentError } from "../domain/payment-errors";

export class PaymentProviderRegistry {
  private providers = new Map<string, PaymentProvider>();

  register(provider: PaymentProvider) {
    this.providers.set(provider.providerCode, provider);
  }

  get(providerCode: string): PaymentProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      throw new PaymentError(
        500,
        "PROVIDER_ERROR",
        `Provider de pagos no soportado: ${providerCode}`
      );
    }
    return provider;
  }
}

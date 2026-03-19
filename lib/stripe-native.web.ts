// Web shim for @stripe/stripe-react-native (native-only package)
import type { ReactNode } from 'react';

export function StripeProvider({ children }: { children: ReactNode }): any {
  return children;
}

export function useStripe() {
  return {
    initPaymentSheet: async (_opts: any) => ({ error: { message: 'Stripe is not available on web' } }),
    presentPaymentSheet: async () => ({ error: { code: 'Canceled', message: 'Stripe is not available on web' } }),
  };
}

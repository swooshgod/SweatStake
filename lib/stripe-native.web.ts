// Web shim for @stripe/stripe-react-native (native-only package)
import React from 'react';

export function StripeProvider({ children }: { children: React.ReactNode }) {
  return children;
}

export function useStripe() {
  return {
    initPaymentSheet: async (_opts: any) => ({ error: { message: 'Stripe is not available on web' } }),
    presentPaymentSheet: async () => ({ error: { code: 'Canceled', message: 'Stripe is not available on web' } }),
  };
}

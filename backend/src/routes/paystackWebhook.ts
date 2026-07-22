import type { Request, Response } from 'express';
import { handlePaystackWebhookEvent } from '../services/onlinePaymentService.js';

/** POST /api/payments/webhook — public Paystack webhook (raw JSON body) */
export async function paystackWebhookHandler(req: Request, res: Response) {
  try {
    const signature = String(req.headers['x-paystack-signature'] || '');
    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody) || !signature) {
      console.error('[Paystack webhook] Missing signature or body');
      return res.status(200).send('OK');
    }

    await handlePaystackWebhookEvent(rawBody, signature);
    return res.status(200).send('OK');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    console.error('[Paystack webhook]', message);
    return res.status(200).send('OK');
  }
}

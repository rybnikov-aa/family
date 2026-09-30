import webpush from 'web-push';
import { env } from '../config/env';
import {
  deletePushSubscription,
  listPushSubscriptions,
  upsertPushSubscription,
} from '../db/pushRepository';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

const configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
if (configured)
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

export function isPushConfigured(): boolean {
  return configured;
}

export function getPushPublicKey(): string | null {
  return configured ? env.VAPID_PUBLIC_KEY : null;
}

export function savePushSubscription(userId: number, input: PushSubscriptionInput): void {
  if (!input.endpoint || !input.keys?.p256dh || !input.keys.auth)
    throw new Error('Некорректная push-подписка');
  upsertPushSubscription({
    userId,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
  });
}

export function removePushSubscription(userId: number, endpoint: string): void {
  deletePushSubscription(endpoint, userId);
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  if (!configured) return;
  const body = JSON.stringify(payload);
  await Promise.all(
    listPushSubscriptions().map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) deletePushSubscription(subscription.endpoint);
        else console.error('Не удалось отправить Web Push', error);
      }
    }),
  );
}

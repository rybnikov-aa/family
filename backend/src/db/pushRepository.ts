import { getPushDb } from './pushDatabase';

export interface PushSubscriptionRow {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  updated_at: string;
}

export interface PushSubscriptionInput {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function upsertPushSubscription(input: PushSubscriptionInput): void {
  getPushDb()
    .prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh,
       auth = excluded.auth, updated_at = datetime('now')`,
    )
    .run(input.userId, input.endpoint, input.p256dh, input.auth);
}

export function listPushSubscriptions(): PushSubscriptionRow[] {
  return getPushDb()
    .prepare('SELECT * FROM push_subscriptions')
    .all() as unknown as PushSubscriptionRow[];
}

export function deletePushSubscription(endpoint: string, userId?: number): void {
  if (userId === undefined)
    getPushDb().prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  else
    getPushDb()
      .prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
      .run(endpoint, userId);
}

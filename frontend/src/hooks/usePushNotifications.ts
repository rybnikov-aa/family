import { useState } from 'react';
import { fetchPushConfig, subscribePush, unsubscribePush } from '../api/client';

function decodeKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0)).buffer as ArrayBuffer;
}

export function usePushNotifications() {
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    if (!supported) throw new Error('Этот браузер не поддерживает Web Push');
    setBusy(true);
    try {
      const config = await fetchPushConfig();
      if (!config.configured || !config.publicKey)
        throw new Error('Push-уведомления не настроены на сервере');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Разрешение на уведомления не выдано');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(config.publicKey),
      });
      await subscribePush(subscription);
      setEnabled(true);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    setBusy(true);
    try {
      await unsubscribePush(subscription.endpoint);
      await subscription.unsubscribe();
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  return { supported, enabled, busy, enable, disable };
}

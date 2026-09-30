import { useEffect, useState } from 'react';
import type { PlanTask } from '../api/client';

export function usePlanReminders(tasks: PlanTask[]) {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    supported ? Notification.permission : 'unsupported',
  );

  const enable = async () => {
    if (!supported) return;
    setPermission(await Notification.requestPermission());
  };

  useEffect(() => {
    if (permission !== 'granted') return;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todayValue = today.toISOString().slice(0, 10);
    const tomorrowValue = tomorrow.toISOString().slice(0, 10);
    for (const task of tasks) {
      if (!task.dueDate || task.status === 'done') continue;
      const isDue = task.dueDate <= todayValue;
      const isSoon = task.dueDate === tomorrowValue;
      if (!isDue && !isSoon) continue;
      const key = `plan-reminder:${task.id}:${task.dueDate}`;
      if (localStorage.getItem(key)) continue;
      new Notification(isDue ? 'Просроченная задача' : 'Задача на завтра', { body: task.title });
      localStorage.setItem(key, '1');
    }
  }, [permission, tasks]);

  return { permission, supported, enable };
}

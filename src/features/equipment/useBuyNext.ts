import { useCallback, useEffect, useRef, useState } from 'react';
import type { EquipmentInventory, Profile } from '@/domain';
import type { PurchaseAdvice } from '@/engine';
import type { BuyNextMessage, UnchangedPurchase } from './buyNextTypes';

export type BuyNextState =
  | { status: 'idle' }
  | { status: 'computing'; done: number; total: number }
  | { status: 'done'; advice: PurchaseAdvice[]; unchanged: UnchangedPurchase[] }
  | { status: 'error' };

interface Stored {
  run: string;
  state: BuyNextState;
}

/**
 * Runs the purchase advice in a worker, only while `active` and only when the inventory
 * differs from the one last computed. `retry` runs it again.
 */
export function useBuyNext(
  profile: Profile | null | undefined,
  inventory: EquipmentInventory,
  active: boolean,
): { state: BuyNextState; retry: () => void } {
  const [stored, setStored] = useState<Stored | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastRun = useRef<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const inventoryJson = JSON.stringify(inventory);
  const run = `${inventoryJson}|${attempt}`;

  useEffect(() => {
    if (!active || !profile || lastRun.current === run) return;
    lastRun.current = run;
    worker.current?.terminate();
    const fail = () => setStored({ run, state: { status: 'error' } });
    let instance: Worker;
    try {
      instance = new Worker(new URL('./buyNext.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      const timer = setTimeout(fail, 0);
      return () => clearTimeout(timer);
    }
    worker.current = instance;
    instance.onmessage = (event: MessageEvent<BuyNextMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        setStored({
          run,
          state: { status: 'computing', done: message.done, total: message.total },
        });
      } else {
        setStored({
          run,
          state: { status: 'done', advice: message.advice, unchanged: message.unchanged },
        });
        instance.terminate();
      }
    };
    instance.onerror = () => {
      fail();
      instance.terminate();
    };
    instance.postMessage({ profile, equipment: JSON.parse(inventoryJson) as EquipmentInventory });
  }, [active, profile, run, inventoryJson]);

  useEffect(() => () => worker.current?.terminate(), []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: BuyNextState =
    stored?.run === run
      ? stored.state
      : active
        ? { status: 'computing', done: 0, total: 0 }
        : { status: 'idle' };
  return { state, retry };
}

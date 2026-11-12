/// <reference lib="webworker" />
import { buyNext, PURCHASE_OPTIONS } from '@/engine';
import type { BuyNextMessage, BuyNextRequest } from './buyNextTypes';

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<BuyNextRequest>) => {
  const { profile, equipment } = event.data;
  const post = (message: BuyNextMessage) => scope.postMessage(message);
  const advice = buyNext(profile, equipment, undefined, (done, total) =>
    post({ type: 'progress', done, total }),
  );
  const advised = new Set(advice.map((a) => a.id));
  const unchanged = PURCHASE_OPTIONS.filter(
    (option) => option.applies(equipment, profile) && !advised.has(option.id),
  ).map((option) => ({ id: option.id, item: option.item }));
  post({ type: 'result', advice, unchanged });
};

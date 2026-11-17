import { useMemo } from 'react';
import { useProfile } from '@/app/data';
import { useProgressContext } from '@/app/progress';
import type { TestContext } from '@/engine';

/** What scheduling and pain checks for max tests read; undefined while anything loads. */
export function useTestContext(): TestContext | undefined {
  const ctx = useProgressContext();
  const profile = useProfile();
  return useMemo(() => {
    if (!ctx || profile === undefined) return undefined;
    return {
      logs: ctx.logs,
      programmes: ctx.programmes,
      answers: ctx.answers,
      maxTests: ctx.maxTests ?? [],
      inventory: ctx.inventory,
      ...(profile && { level: profile.level }),
      ...(profile?.bodyweightKg !== undefined && { bodyweightKg: profile.bodyweightKg }),
    };
  }, [ctx, profile]);
}

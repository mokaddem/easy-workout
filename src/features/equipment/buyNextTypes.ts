import type { EquipmentInventory, EquipmentItem, Profile } from '@/domain';
import type { PurchaseAdvice } from '@/engine';

export interface BuyNextRequest {
  profile: Profile;
  equipment: EquipmentInventory;
}

/** A purchase that was tried and would not change the programme. */
export interface UnchangedPurchase {
  id: string;
  item: EquipmentItem;
}

export type BuyNextMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; advice: PurchaseAdvice[]; unchanged: UnchangedPurchase[] };

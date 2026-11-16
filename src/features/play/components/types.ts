import type { EquipmentInventory, Language, SessionLog } from '@/domain';
import type { PlayStep } from '@/engine';
import type { Player } from '../usePlayer';

/** What every player screen reads besides the step it shows. */
export interface PlayContext {
  lang: Language;
  inventory: EquipmentInventory;
  log: SessionLog;
  player: Player;
  step: PlayStep;
}

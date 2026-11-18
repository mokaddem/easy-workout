import { useState } from 'react';

/**
 * True once something that was waiting (the lazy figure code) has arrived, so the entrance only
 * plays for a figure that appears late and never for one already at hand.
 */
export function useArrival(waiting: boolean, arrived: boolean): boolean {
  const [wasWaiting, setWasWaiting] = useState(waiting);
  if (waiting && !wasWaiting) setWasWaiting(true);
  return wasWaiting && arrived;
}

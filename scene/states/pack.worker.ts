/**
 * Builds the state texture off the main thread.
 *
 * At 30k particles this is ~30ms of rejection sampling and trigonometry, which
 * is a visible hitch if it lands on the main thread during the opening act —
 * the one moment the page is asking to feel still.
 */
import { packStates } from './pack';

self.onmessage = (event: MessageEvent<{ count: number }>) => {
  const packed = packStates(event.data.count);
  self.postMessage(packed, {
    transfer: [packed.data.buffer, packed.stagger.buffer, packed.seed.buffer],
  });
};

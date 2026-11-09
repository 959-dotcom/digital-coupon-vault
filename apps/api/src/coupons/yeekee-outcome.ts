import { createHash, randomBytes } from 'node:crypto';

export type YeekeeDraw = {
  top3: string;
  bottom2: string;
  seedHash: string;
};

export function yeekeeOutcomeFromSeed(seed: Uint8Array): YeekeeDraw {
  if (seed.byteLength < 8) {
    throw new Error('INVALID_ITEM');
  }
  const seedHash = createHash('sha256').update(seed).digest('hex');
  return {
    top3: digitsFrom(seed.subarray(0, 4), 3),
    bottom2: digitsFrom(seed.subarray(4, 8), 2),
    seedHash,
  };
}

export function drawYeekeeOutcome(): YeekeeDraw {
  return yeekeeOutcomeFromSeed(randomBytes(32));
}

function digitsFrom(bytes: Uint8Array, length: number): string {
  const value = Buffer.from(bytes).readUInt32BE(0) % 10 ** length;
  return value.toString().padStart(length, '0');
}

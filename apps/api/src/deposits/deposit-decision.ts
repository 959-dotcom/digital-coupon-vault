export type ReviewStatus = 'PENDING' | 'REVIEW' | 'PAID' | 'REJECTED' | 'EXPIRED';

export type ReviewDecision = {
  nextStatus: ReviewStatus;
  credit: boolean;
  changed: boolean;
};

export function decideReview(status: string, action: 'approve' | 'reject'): ReviewDecision {
  const current = status as ReviewStatus;
  if (status !== 'REVIEW') {
    return { nextStatus: current, credit: false, changed: false };
  }
  if (action === 'approve') {
    return { nextStatus: 'PAID', credit: true, changed: true };
  }
  return { nextStatus: 'REJECTED', credit: false, changed: true };
}

export async function settleLocked(
  lock: <T>(fn: () => Promise<T>) => Promise<T>,
  read: () => Promise<{ status: string }>,
  write: (status: ReviewStatus) => Promise<void>,
  credit: () => Promise<void>,
  action: 'approve' | 'reject',
): Promise<{ credited: boolean; status: ReviewStatus }> {
  return lock(async () => {
    const row = await read();
    const decision = decideReview(row.status, action);
    if (!decision.changed) {
      return { credited: false, status: decision.nextStatus };
    }
    if (decision.credit) {
      await credit();
    }
    await write(decision.nextStatus);
    return { credited: decision.credit, status: decision.nextStatus };
  });
}

export function reserveSlip(seen: Set<string>, hash: string): void {
  if (seen.has(hash)) {
    throw new Error('SLIP_REUSED');
  }
  seen.add(hash);
}

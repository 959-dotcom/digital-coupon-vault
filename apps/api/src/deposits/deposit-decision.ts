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
): Promise<{ credited: boolean; status: ReviewStatus; changed: boolean }> {
  return lock(async () => {
    const row = await read();
    const decision = decideReview(row.status, action);
    if (!decision.changed) {
      return { credited: false, status: decision.nextStatus, changed: false };
    }
    if (decision.credit) {
      await credit();
    }
    await write(decision.nextStatus);
    return { credited: decision.credit, status: decision.nextStatus, changed: true };
  });
}

export function decisionEdit(input: {
  chatId: string;
  messageId: number;
  photo: boolean;
  original: string;
  action: 'approve' | 'reject';
}): { method: 'editMessageCaption' | 'editMessageText'; body: Record<string, unknown> } {
  const label = input.action === 'approve' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว';
  const base = input.original.trim();
  const text = base.length > 0 ? `${base}\n${label}` : label;
  return {
    method: input.photo ? 'editMessageCaption' : 'editMessageText',
    body: {
      chat_id: input.chatId,
      message_id: input.messageId,
      reply_markup: { inline_keyboard: [] },
      ...(input.photo ? { caption: text } : { text }),
    },
  };
}

export function reserveSlip(seen: Set<string>, hash: string): void {
  if (seen.has(hash)) {
    throw new Error('SLIP_REUSED');
  }
  seen.add(hash);
}

export const copy = {
  brand: 'Vantage',
  tagline: 'ระบบคูปองดิจิทัลและสายงานตัวแทน',
  login: {
    title: 'เข้าสู่ระบบ',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    submit: 'เข้าสู่ระบบ',
    submitting: 'กำลังตรวจสอบ',
    failed: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  },
  nav: {
    catalog: 'แคตตาล็อก',
    orders: 'รายการของฉัน',
    flow: 'ประวัติแต้ม',
    hierarchy: 'สายงาน',
    settlement: 'ตรวจผล',
    withdrawals: 'คิวถอน',
    audit: 'บันทึกตรวจ',
    notifications: 'การแจ้งเตือน',
    logout: 'ออกจากระบบ',
    balance: 'แต้มคงเหลือ',
  },
  catalog: {
    title: 'เลือกหมวดคูปอง',
    empty: 'ยังไม่มีหมวดคูปองที่เปิดขาย',
    error: 'โหลดหมวดคูปองไม่สำเร็จ',
    retry: 'ลองอีกครั้ง',
    open: 'เปิดตารางหมายเลข',
    closed: 'ปิดรับแล้ว',
    loading: 'กำลังโหลด',
    national: 'หวยรัฐบาล',
    regional: 'หวยด่วนต่างประเทศ',
    flash: 'ยี่กี',
    stock: 'ดัชนีหุ้น',
    countdown: 'นับถอยหลังถึงตัดยอด',
    countdownNone: 'ยังไม่มีงวดถัดไป',
    pick: 'เลือกเลข',
  },
  selection: {
    title: 'เลือกประเภทและหมายเลข',
    exact3: 'สามหลักตรง',
    perm: 'สามหลักโต๊ด',
    top2: 'สองหลักบน',
    bottom2: 'สองหลักล่าง',
    float: 'เลขวิ่ง',
    floatTop: 'วิ่งบน',
    floatBottom: 'วิ่งล่าง',
    floatMix: 'วิ่งผสม',
    number: 'หมายเลข',
    add: 'เพิ่มรายการ',
    clear: 'ล้าง',
    deleteDigit: 'ลบ',
    badNumber: 'จำนวนหลักไม่ตรงกับประเภทที่เลือก',
    total: 'แต้มรวม',
    liveTotal: 'แต้มรวมตอนนี้',
    empty: 'ยังไม่มีรายการในใบสั่งซื้อ',
  },
  settlement: {
    title: 'ตรวจผลและจ่ายรางวัล',
    empty: 'ยังไม่มีงวดให้ตรวจผล',
    error: 'โหลดงวดไม่สำเร็จ',
    forbidden: 'เฉพาะผู้ดูแลระบบที่ตรวจผลได้',
    batch: 'งวด',
    top3: 'สามหลักบน',
    bottom2: 'สองหลักล่าง',
    submit: 'จ่ายรางวัล',
    submitting: 'กำลังจ่าย',
    done: 'ปิดงวดและบันทึกบัญชีแล้ว',
    badOutcome: 'กรอกสามหลักบน 3 หลัก และสองหลักล่าง 2 หลัก',
    audit: 'บันทึกการตรวจ',
  },
  desk: {
    stake: 'ราคาต่อใบ',
    selected: 'รายการที่เลือก',
    emptySelection: 'แตะหมายเลขบนตารางเพื่อเริ่มใบสั่งซื้อ',
    quantity: 'จำนวน',
    remove: 'เอาออก',
    total: 'ยอดรวม',
    submit: 'ยืนยันคำสั่งซื้อ',
    submitting: 'กำลังปิดผนึกคำสั่งซื้อ',
    noBatch: 'งวดนี้ปิดรับแล้วตามเวลาประเทศไทย',
    noCategory: 'ไม่พบหมวดคูปองนี้',
    loadError: 'โหลดตารางหมายเลขไม่สำเร็จ',
    number: 'หมายเลข',
    batch: 'งวด',
    cutoff: 'ตัดยอด',
  },
  receipt: {
    title: 'ใบเสร็จดิจิทัล',
    seal: 'ตราประทับคลัง SHA-256',
    verified: 'ตรวจสอบแฮชตรงกับรายการแล้ว',
    mismatch: 'แฮชไม่ตรงกับรายการ',
    close: 'ปิด',
    total: 'ยอดชำระ',
    status: 'สถานะ',
    when: 'เวลาบันทึก',
  },
  flow: {
    title: 'ประวัติแต้ม',
    empty: 'ยังไม่มีรายการในสมุดแต้ม',
    error: 'โหลดประวัติแต้มไม่สำเร็จ',
    debit: 'เดบิต',
    credit: 'เครดิต',
    running: 'คงเหลือหลังรายการ',
    withdraw: 'ถอนแต้ม',
    amount: 'จำนวนแต้ม',
    destination: 'บัญชีรับเงิน',
    destinationHint: 'เลขพร้อมเพย์หรือเลขบัญชีธนาคาร',
    submit: 'ส่งคำขอถอน',
    submitting: 'กำลังส่งคำขอ',
    done: 'ส่งคำขอแล้ว รอผู้ดูแลตรวจสอบ',
    requests: 'คำขอถอน',
    requestsEmpty: 'ยังไม่มีคำขอถอน',
    badAmount: 'กรอกจำนวนแต้มที่มากกว่าศูนย์',
  },
  orders: {
    title: 'รายการของฉัน',
    empty: 'ยังไม่มีคำสั่งซื้อ เปิดแคตตาล็อกแล้วเลือกหมายเลขได้เลย',
    error: 'โหลดรายการไม่สำเร็จ',
    hash: 'แฮชคลัง',
  },
  hierarchy: {
    title: 'โครงสร้างสายงาน',
    empty: 'ยังไม่มีพันธมิตรในสายงาน',
    error: 'โหลดสายงานไม่สำเร็จ',
    rates: 'อัตราคอมมิชชัน',
    mode: 'โหมดการจ่าย',
    save: 'บันทึก',
    saving: 'กำลังบันทึก',
    saved: 'บันทึกแล้ว',
    selfLocked: 'พันธมิตรหลักแก้ได้เฉพาะสายล่าง ไม่รวมโหนดของตนเอง',
    viewerLocked: 'เฉพาะผู้ดูแลระบบและพันธมิตรหลักที่แก้ค่าคอมมิชชันของสายล่างได้',
    pick: 'เลือกพันธมิตรเพื่อตั้งอัตรา',
    ledger: 'สมุดบัญชี',
    ledgerEmpty: 'ยังไม่มีรายการบัญชี',
    ledgerError: 'โหลดสมุดบัญชีไม่สำเร็จ',
    debit: 'เดบิต',
    credit: 'เครดิต',
    balanced: 'สมดุล',
    unbalanced: 'ไม่สมดุล',
    grandDebit: 'เดบิตรวม',
    grandCredit: 'เครดิตรวม',
    previous: 'ก่อนหน้า',
    next: 'ถัดไป',
    page: 'หน้า',
    active: 'ใช้งาน',
    inactive: 'ปิดใช้งาน',
    tree: 'ผังสายงาน',
    report: 'รายงานค่าคอม',
    children: 'พันธมิตรลูก',
    members: 'สมาชิกที่ใช้งาน',
    flow: 'กระแสแต้มรวม',
    expand: 'ขยาย',
    collapse: 'ย่อ',
  },
  report: {
    title: 'รายงานค่าคอมมิชชัน',
    empty: 'ไม่มีค่าคอมในช่วงวันที่นี้',
    error: 'โหลดรายงานไม่สำเร็จ',
    from: 'ตั้งแต่วันที่',
    to: 'ถึงวันที่',
    apply: 'ดูรายงาน',
    total: 'ค่าคอมรวม',
    byDay: 'รายวัน',
    byBatch: 'รายงวด',
    day: 'วันที่',
    batch: 'งวด',
  },
  audit: {
    title: 'บันทึกผู้ดูแล',
    empty: 'ยังไม่มีบันทึก',
    error: 'โหลดบันทึกไม่สำเร็จ',
    search: 'ค้นหา',
    placeholder: 'การกระทำ เป้าหมาย หรือรายละเอียด',
    forbidden: 'เฉพาะผู้ดูแลระบบที่ดูบันทึกนี้ได้',
    when: 'เวลา',
    action: 'การกระทำ',
    target: 'เป้าหมาย',
    actions: {
      LEDGER_ADJUSTMENT: 'ปรับสมุดบัญชี',
      BATCH_SETTLEMENT: 'ปิดงวดและจ่ายรางวัล',
      ORACLE_SETTLEMENT: 'ปิดงวดจากแหล่งผลรางวัล',
      WITHDRAWAL_DECISION: 'ตรวจคำขอถอน',
      COMMISSION_RATE_UPDATE: 'แก้ค่าคอมมิชชัน',
      ADMIN_LOGIN: 'เข้าสู่ระบบผู้ดูแล',
    },
  },
  inbox: {
    title: 'การแจ้งเตือน',
    empty: 'ยังไม่มีการแจ้งเตือน',
    error: 'โหลดการแจ้งเตือนไม่สำเร็จ',
    unread: 'ยังไม่อ่าน',
    read: 'อ่านแล้ว',
    mark: 'ทำเครื่องหมายว่าอ่านแล้ว',
    markAll: 'อ่านทั้งหมด',
  },
  modes: {
    COMMISSION_ONLY: 'คอมมิชชันอย่างเดียว',
    FULL_PASS: 'ส่งต่อทั้งก้อน',
    SPLIT_KEEP: 'แบ่งเก็บ',
  },
  modeHelp: {
    COMMISSION_ONLY: 'ได้ส่วนต่างอัตรา และส่งความเสี่ยงของยอดทั้งก้อนให้สายบน',
    FULL_PASS: 'ไม่เก็บส่วนต่าง ส่งยอดและความเสี่ยงให้สายบน',
    SPLIT_KEEP: 'เก็บยอดตามสัดส่วนอัตรา ส่วนที่เหลือส่งขึ้นไป',
  },
  roles: {
    SUPER_ADMIN: 'ผู้ดูแลระบบ',
    MASTER_PARTNER: 'พันธมิตรหลัก',
    PARTNER: 'พันธมิตร',
    MEMBER: 'สมาชิก',
  },
  status: {
    PENDING: 'รอดำเนินการ',
    APPROVED: 'อนุมัติแล้ว',
    REJECTED: 'ปฏิเสธแล้ว',
    ACCEPTED: 'รับแล้ว',
    CONFIRMED: 'ยืนยันแล้ว',
    SETTLED: 'ชำระแล้ว',
    CANCELLED_SYSTEM: 'ยกเลิกโดยระบบ',
  },
  accounts: {
    ASSET: 'สินทรัพย์',
    LIABILITY: 'หนี้สิน',
    REVENUE: 'รายได้',
    EXPENSE: 'ค่าใช้จ่าย',
  },
  memos: {
    REDEEM_POINTS: 'ตัดแต้มเพื่อสั่งคูปอง',
    COUPON_SALE: 'รับรู้รายได้ขายคูปอง',
    COMMISSION_EXPENSE: 'ค่าคอมมิชชัน',
    COMMISSION_PAYABLE: 'เจ้าหนี้คอมมิชชัน',
    FUND_CASH: 'เงินสดเข้าระบบ',
    FUND_POINTS: 'เติมแต้มให้สมาชิก',
    PAYOUT_EXPENSE: 'จ่ายรางวัล',
    PAYOUT_POINTS: 'แต้มรางวัลเข้าสมาชิก',
    WITHDRAW_POINTS: 'ตัดแต้มเพื่อถอน',
    WITHDRAW_CASH: 'จ่ายเงินสดออก',
  },
  errors: {
    generic: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง',
    validation: 'ข้อมูลไม่ถูกต้อง ตรวจสอบจำนวนและรายการอีกครั้ง',
    network: 'ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ',
    forbidden: 'คุณไม่มีสิทธิ์ทำรายการนี้',
    cutoff: 'เลยเวลาตัดยอดของงวดนี้แล้ว',
    balance: 'แต้มไม่พอสำหรับคำสั่งซื้อนี้',
    rate: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่',
    hmac: 'คำขอหมดอายุหรือลายเซ็นไม่ถูกต้อง',
    closed: 'หมวดหรือวงปิดรับแล้ว',
    wallet: 'ระบบกำลังปรับยอด กรุณาลองอีกครั้ง',
  },
  queue: {
    title: 'คิวถอนแต้ม',
    empty: 'ไม่มีคำขอที่รอตรวจ',
    error: 'โหลดคิวไม่สำเร็จ',
    forbidden: 'เฉพาะผู้ดูแลระบบที่อนุมัติการถอนได้',
    approve: 'อนุมัติ',
    reject: 'ปฏิเสธ',
    member: 'สมาชิก',
    conflict: 'คำขอนี้ถูกตรวจไปแล้ว',
  },
  states: {
    loading: 'กำลังโหลด',
    notFound: 'ไม่พบหน้านี้',
    backHome: 'กลับหน้าแรก',
    appError: 'ระบบขัดข้องชั่วคราว',
  },
} as const;

const errorMap: Record<string, string> = {
  INVALID_CREDENTIALS: copy.login.failed,
  HMAC_INVALID: copy.errors.hmac,
  HMAC_EXPIRED: copy.errors.hmac,
  HMAC_NONCE_REUSED: copy.errors.hmac,
  FORBIDDEN: copy.errors.forbidden,
  PARTNER_SCOPE: copy.errors.forbidden,
  NOT_ATTACHED: copy.errors.forbidden,
  INVALID_AMOUNT: copy.errors.validation,
  INVALID_ITEM: copy.errors.validation,
  UNKNOWN_CATEGORY: copy.errors.validation,
  CATEGORY_INACTIVE: copy.desk.noCategory,
  BATCH_CLOSED: copy.errors.closed,
  BATCH_SETTLED: copy.errors.closed,
  BATCH_NOT_FOUND: copy.settlement.empty,
  CUTOFF_PASSED: copy.errors.cutoff,
  INSUFFICIENT_BALANCE: copy.errors.balance,
  WALLET_BUSY: copy.errors.wallet,
  RATE_LIMITED: copy.errors.rate,
  PARTNER_INACTIVE: copy.errors.closed,
  USER_INACTIVE: copy.errors.forbidden,
  ORDER_CANCELLED: copy.errors.generic,
  CONFLICT: copy.queue.conflict,
};

export function translateError(message: unknown): string {
  const text = Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : '';
  for (const [code, label] of Object.entries(errorMap)) {
    if (text.includes(code)) {
      return label;
    }
  }
  if (!text || text === 'Bad Request' || text.startsWith('[')) {
    return copy.errors.validation;
  }
  return copy.errors.generic;
}

export function memoLabel(memo: string): string {
  return memo in copy.memos ? copy.memos[memo as keyof typeof copy.memos] : memo;
}

export function statusLabel(status: string | null): string {
  if (status && status in copy.status) {
    return copy.status[status as keyof typeof copy.status];
  }
  return status ?? '—';
}

export function modeLabel(mode: string): string {
  if (mode in copy.modes) {
    return copy.modes[mode as keyof typeof copy.modes];
  }
  return mode;
}

export function roleLabel(role: string): string {
  if (role in copy.roles) {
    return copy.roles[role as keyof typeof copy.roles];
  }
  return role;
}

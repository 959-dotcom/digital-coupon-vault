export type ReportScope = 'all' | 'downline' | 'none';

export type StaffPermissions = {
  viewBalance: boolean;
  viewReports: ReportScope;
  manageCredit: boolean;
  manageMembers: boolean;
};

export type StaffAction = 'balance' | 'reports' | 'credit' | 'members';

export const LOCKED_PERMISSIONS: StaffPermissions = {
  viewBalance: false,
  viewReports: 'none',
  manageCredit: false,
  manageMembers: false,
};

export function readPermissions(value: unknown): StaffPermissions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return LOCKED_PERMISSIONS;
  }
  const row = value as Record<string, unknown>;
  const reports = row.viewReports;
  return {
    viewBalance: row.viewBalance === true,
    viewReports: reports === 'all' || reports === 'downline' ? reports : 'none',
    manageCredit: row.manageCredit === true,
    manageMembers: row.manageMembers === true,
  };
}

export function allows(permissions: StaffPermissions, action: StaffAction): boolean {
  if (action === 'balance') {
    return permissions.viewBalance;
  }
  if (action === 'credit') {
    return permissions.manageCredit;
  }
  if (action === 'members') {
    return permissions.manageMembers;
  }
  return permissions.viewReports !== 'none';
}

export const PRODUCT_CODES = [
  'LA_DEVELOP',
  'LA_STAR',
  'STOCK_DOWJONES',
  'STOCK_HANGSENG',
  'STOCK_NIKKEI',
  'STOCK_SET_TH',
  'TH_AGRI_BAAC',
  'TH_NATION_D2',
  'TH_NATION_D3',
  'TH_SAVINGS_GSB',
  'VN_HN_REGULAR',
  'VN_HN_SPECIAL',
  'VN_HN_VIP',
  'YEEKEE_15M',
  'YEEKEE_10M',
] as const;

export type ProductCode = (typeof PRODUCT_CODES)[number];

const PRODUCT_NAMES: Record<ProductCode, string> = {
  LA_DEVELOP: 'ลาวพัฒนา',
  LA_STAR: 'ลาวสตาร์',
  STOCK_DOWJONES: 'หุ้นดาวโจนส์',
  STOCK_HANGSENG: 'หุ้นฮั่งเส็ง',
  STOCK_NIKKEI: 'หุ้นนิเคอิ',
  STOCK_SET_TH: 'หุ้นไทย',
  TH_AGRI_BAAC: 'สลาก ธ.ก.ส.',
  TH_NATION_D2: 'หวยรัฐบาล สองหลัก',
  TH_NATION_D3: 'หวยรัฐบาล สามหลัก',
  TH_SAVINGS_GSB: 'สลากออมสิน',
  VN_HN_REGULAR: 'ฮานอยปกติ',
  VN_HN_SPECIAL: 'ฮานอยพิเศษ',
  VN_HN_VIP: 'ฮานอย VIP',
  YEEKEE_15M: 'ยี่กี 15 นาที',
  YEEKEE_10M: 'ยี่กี VIP 10 นาที',
};

export function isProductCode(value: string): value is ProductCode {
  return (PRODUCT_CODES as readonly string[]).includes(value);
}

export function productName(code: ProductCode): string {
  return PRODUCT_NAMES[code];
}

export function closedByAncestor(
  flags: readonly { userId: string; isActive: boolean }[],
  ancestorIdsNearestFirst: readonly string[],
): boolean {
  const byUser = new Map(flags.map((flag) => [flag.userId, flag.isActive]));
  for (const id of ancestorIdsNearestFirst) {
    const active = byUser.get(id);
    if (active !== undefined) {
      return !active;
    }
  }
  return false;
}

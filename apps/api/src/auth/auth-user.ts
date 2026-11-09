export const ROLES = ['SUPER_ADMIN', 'MASTER_PARTNER', 'PARTNER', 'MEMBER'] as const;
export type RoleName = (typeof ROLES)[number];

export type AuthUser = {
  userId: string;
  email: string;
  role: RoleName;
  partnerId: string | null;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: RoleName;
  partnerId: string | null;
};

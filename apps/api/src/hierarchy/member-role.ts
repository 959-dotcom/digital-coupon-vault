import type { RoleName } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';

const RANK: Record<RoleName, number> = {
  SUPER_ADMIN: 0,
  MASTER_PARTNER: 1,
  PARTNER: 2,
  MEMBER: 3,
};

export function assignableRoles(parentRole: string): RoleName[] {
  if (parentRole === 'SUPER_ADMIN') {
    return ['MASTER_PARTNER', 'PARTNER', 'MEMBER'];
  }
  if (parentRole === 'MASTER_PARTNER') {
    return ['PARTNER', 'MEMBER'];
  }
  return ['MEMBER'];
}

export function assertAssignableRole(parentRole: string, childRole: string): asserts childRole is RoleName {
  if (!assignableRoles(parentRole).includes(childRole as RoleName)) {
    throw new DomainError('FORBIDDEN');
  }
}

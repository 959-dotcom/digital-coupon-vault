import assert from 'node:assert/strict';
import test from 'node:test';
import { redactSecrets } from '../src/audit/redact.js';
import { DomainError } from '../src/common/domain-error.js';
import { assertAssignableRole, assignableRoles } from '../src/hierarchy/member-role.js';

test('a principal can assign only roles below their own rank', () => {
  assert.deepEqual(assignableRoles('SUPER_ADMIN'), ['MASTER_PARTNER', 'PARTNER', 'MEMBER']);
  assert.deepEqual(assignableRoles('MASTER_PARTNER'), ['PARTNER', 'MEMBER']);
  assert.deepEqual(assignableRoles('PARTNER'), ['MEMBER']);
  assert.deepEqual(assignableRoles('MEMBER'), ['MEMBER']);
  assertAssignableRole('MASTER_PARTNER', 'MEMBER');
  assert.throws(() => assertAssignableRole('MASTER_PARTNER', 'MASTER_PARTNER'), DomainError);
  assert.throws(() => assertAssignableRole('PARTNER', 'SUPER_ADMIN'), DomainError);
  assert.throws(() => assertAssignableRole('MEMBER', 'PARTNER'), DomainError);
});

test('password reset audits keep the new password out of the log', () => {
  const detail = redactSecrets({ userId: 'member-1', password: 'secret-value', passwordHash: 'hash' });
  assert.deepEqual(detail, { userId: 'member-1' });
});

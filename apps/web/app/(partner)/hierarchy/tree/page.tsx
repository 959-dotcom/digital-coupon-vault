'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy, modeLabel } from '@/lib/copy';
import { formatPoints } from '@/lib/money';
import type { OrgChartNode } from '@/lib/types';

export default function OrgTreePage() {
  const user = useAuth((state) => state.user);
  const tree = useQuery({
    queryKey: ['org-chart'],
    queryFn: () => api.orgChart(),
    enabled: user?.role === 'SUPER_ADMIN' || user?.role === 'MASTER_PARTNER' || user?.role === 'PARTNER',
  });

  if (user && user.role === 'MEMBER') {
    return <StatePanel title={copy.errors.forbidden} />;
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-white">{copy.hierarchy.tree}</h1>
      <div className="mt-4 space-y-3">
        {tree.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
        {tree.isError ? <StatePanel title={copy.hierarchy.error} onRetry={() => void tree.refetch()} /> : null}
        {tree.isSuccess && tree.data.length === 0 ? <StatePanel title={copy.hierarchy.empty} /> : null}
        {tree.data?.map((node) => (
          <OrgBranch key={node.id} node={node} depth={0} />
        ))}
      </div>
    </section>
  );
}

function OrgBranch({ node, depth }: { node: OrgChartNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  return (
    <div className={depth > 0 ? 'ml-3 border-l border-line pl-3' : ''}>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-brass">{node.code}</p>
            <h2 className="text-base font-semibold">{node.name}</h2>
          </div>
          <Badge className={node.isActive ? 'bg-pine-soft text-pine' : 'bg-danger-soft text-danger'}>
            {node.isActive ? copy.hierarchy.active : copy.hierarchy.inactive}
          </Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-white/55">{copy.hierarchy.children}</dt>
            <dd className="font-mono text-sm">{node.childPartnerCount}</dd>
          </div>
          <div>
            <dt className="text-white/55">{copy.hierarchy.members}</dt>
            <dd className="font-mono text-sm">{node.activeMemberCount}</dd>
          </div>
          <div>
            <dt className="text-white/55">{copy.hierarchy.flow}</dt>
            <dd className="font-mono text-sm">{formatPoints(node.pointsFlow)}</dd>
          </div>
          <div>
            <dt className="text-white/55">{copy.hierarchy.mode}</dt>
            <dd className="text-sm">{modeLabel(node.distributionMode)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-white/55">{copy.hierarchy.rates}</p>
        <ul className="mt-1 space-y-1 font-mono text-[11px] text-white/80">
          {Object.entries(node.commissionRates).map(([code, rate]) => (
            <li key={code} className="flex justify-between gap-3">
              <span>{code}</span>
              <span>{rate}</span>
            </li>
          ))}
        </ul>
        {hasChildren ? (
          <button
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#dc2626]"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {open ? copy.hierarchy.collapse : copy.hierarchy.expand}
          </button>
        ) : null}
      </Card>
      {open && hasChildren ? (
        <div className="mt-3 space-y-3">
          {node.children.map((child) => (
            <OrgBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

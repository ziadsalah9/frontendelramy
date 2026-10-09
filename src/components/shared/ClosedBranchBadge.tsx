import { useMainBranch } from '@/hooks/useMainBranch';
import { Badge } from '@/components/shared/DataTable';

/**
 * Single-branch mode: marks history records that belong to a branch that
 * was closed when the store consolidated into one shop. Renders nothing
 * for the main branch.
 */
export function ClosedBranchBadge({ branchId, branchName }: { branchId: number | null | undefined; branchName?: string | null }) {
  const { isMain, branchNameOf, isLoading } = useMainBranch();
  if (isLoading || branchId == null || isMain(branchId)) return null;
  const name = branchName ?? branchNameOf(branchId) ?? `فرع #${branchId}`;
  return <Badge variant="default">{name} (مغلق)</Badge>;
}

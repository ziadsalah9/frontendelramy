import { useQuery } from '@tanstack/react-query';
import { branchesService } from '@/api/branches';
import { useAuth } from '@/hooks/useAuth';

/**
 * The store runs in single-branch mode: one shop, so the UI never asks
 * for a branch. Every request that needs a branch id gets it from here.
 *
 * Employees use their own branch (the backend restricts them to it).
 * Admins use the active branch; if several are active, the lowest id.
 */
export function useMainBranch() {
  const { user, isAdmin } = useAuth();
  const { data: branches, isLoading } = useQuery({ queryKey: ['branches'], queryFn: branchesService.getAll });

  const active = (branches ?? []).filter((b) => b.active !== false).sort((a, b) => a.id - b.id);
  const ownId = !isAdmin && user?.branchId ? user.branchId : undefined;
  const branch = ownId ? (branches ?? []).find((b) => b.id === ownId) : active[0];

  return {
    branchId: ownId ?? branch?.id,
    branchName: branch?.name ?? user?.branchName ?? undefined,
    /** True until the branch id is known (admins need the branches list). */
    isLoading: !ownId && isLoading,
    /** Name lookup for history rows that belong to a closed branch. */
    isMain: (id: number | null | undefined) => id != null && id === (ownId ?? branch?.id),
    branchNameOf: (id: number) => (branches ?? []).find((b) => b.id === id)?.name,
  };
}

import api from './client';
import type { BranchTransfer, BranchTransferCreateInput } from '@/types';

export const branchTransfersService = {
  async getAll(): Promise<BranchTransfer[]> {
    const { data } = await api.get<BranchTransfer[]>('/api/branch-transfers');
    return data;
  },
  async getById(id: number): Promise<BranchTransfer> {
    const { data } = await api.get<BranchTransfer>(`/api/branch-transfers/${id}`);
    return data;
  },
  async create(input: BranchTransferCreateInput): Promise<BranchTransfer> {
    const { data } = await api.post<BranchTransfer>('/api/branch-transfers', input);
    return data;
  },
  async getByFromBranch(branchId: number): Promise<BranchTransfer[]> {
    const { data } = await api.get<BranchTransfer[]>(`/api/branch-transfers/from-branch/${branchId}`);
    return data;
  },
  async getByToBranch(branchId: number): Promise<BranchTransfer[]> {
    const { data } = await api.get<BranchTransfer[]>(`/api/branch-transfers/to-branch/${branchId}`);
    return data;
  },
};

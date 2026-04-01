import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export interface EvaluationContribution {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  contribution_percent: number;
  note: string | null;
}

export interface EvaluationSummary {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  created_by: { id: string; full_name: string; avatar_url: string | null };
  created_at: string;
  updated_at: string;
}

export interface EvaluationDetail extends EvaluationSummary {
  contributions: EvaluationContribution[];
}

export interface ContributionInput {
  user_id: string;
  contribution_percent: number;
  note?: string;
}

export interface CreateEvaluationPayload {
  group_id: string;
  title: string;
  description?: string;
  contributions: ContributionInput[];
}

export interface UpdateEvaluationPayload {
  title?: string;
  description?: string;
  contributions?: ContributionInput[];
}

export const listEvaluations = async (groupId: string, page = 1, limit = 20) => {
  const res = await axiosClient.get<{
    data: EvaluationSummary[];
    total: number;
    page: number;
    limit: number;
  }>(ENDPOINTS.EVALUATIONS.LIST, { params: { group_id: groupId, page, limit } });
  return res.data;
};

export const getEvaluation = async (id: string): Promise<EvaluationDetail> => {
  const res = await axiosClient.get<EvaluationDetail>(ENDPOINTS.EVALUATIONS.DETAIL(id));
  return res.data;
};

export const createEvaluation = async (
  payload: CreateEvaluationPayload
): Promise<EvaluationDetail> => {
  const res = await axiosClient.post<EvaluationDetail>(ENDPOINTS.EVALUATIONS.CREATE, payload);
  return res.data;
};

export const updateEvaluation = async (
  id: string,
  payload: UpdateEvaluationPayload
): Promise<EvaluationDetail> => {
  const res = await axiosClient.patch<EvaluationDetail>(ENDPOINTS.EVALUATIONS.UPDATE(id), payload);
  return res.data;
};

export const deleteEvaluation = async (id: string): Promise<{ message: string }> => {
  const res = await axiosClient.delete<{ message: string }>(ENDPOINTS.EVALUATIONS.DELETE(id));
  return res.data;
};

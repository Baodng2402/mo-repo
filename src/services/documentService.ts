import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DocumentSubmission {
  id: string;
  group_id: string;
  submitted_by_id: string;
  title: string;
  document_url: string;
  status: DocumentStatus;
  score?: number;
  feedback?: string;
  created_at: string;
}

export interface SubmitDocumentPayload {
  title: string;
  document_url: string;
}

/**
 * Get all submissions of a group.
 * GET /api/documents/group/:groupId
 */
export const getGroupSubmissions = async (groupId: string): Promise<DocumentSubmission[]> => {
  const response = await axiosClient.get<DocumentSubmission[]>(
    ENDPOINTS.DOCUMENTS.GROUP_SUBMISSIONS(groupId)
  );
  return response.data;
};

/**
 * Submit a new group document.
 * POST /api/documents/group/:groupId
 */
export const submitGroupDocument = async (
  groupId: string,
  payload: SubmitDocumentPayload
): Promise<DocumentSubmission> => {
  const response = await axiosClient.post<DocumentSubmission>(
    ENDPOINTS.DOCUMENTS.SUBMIT_FOR_GROUP(groupId),
    payload
  );
  return response.data;
};

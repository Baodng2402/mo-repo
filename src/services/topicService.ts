import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export type TopicIdeaMode = 'AUTO' | 'REFINE';

export interface TopicDraft {
  topic_name: string;
  context: string;
  problem_statement: string;
  primary_actors: string;
  uniqueness_rationale: string;
  mode?: TopicIdeaMode;
  duplicate?: boolean;
}

export interface TopicItem {
  id: string;
  name: string;
  description?: string;
  is_taken?: boolean;
}

export interface GenerateTopicIdeaPayload {
  mode: TopicIdeaMode;
  seed_name?: string;
  project_domain?: string;
  team_context?: string;
  problem_space?: string;
  primary_actors_hint?: string;
}

export interface CreateAiTopicPayload {
  topic_name: string;
  context: string;
  problem_statement: string;
  primary_actors: string;
  uniqueness_rationale: string;
}

/**
 * Get topics that are not selected by any group.
 * GET /api/topics/available
 */
export const getAvailableTopics = async (): Promise<TopicItem[]> => {
  const response = await axiosClient.get<TopicItem[]>(ENDPOINTS.TOPICS.AVAILABLE);
  return response.data;
};

/**
 * Generate/refine a topic draft using AI.
 * POST /api/topics/ai/generate
 */
export const generateTopicIdea = async (payload: GenerateTopicIdeaPayload): Promise<TopicDraft> => {
  const response = await axiosClient.post<TopicDraft>(ENDPOINTS.TOPICS.AI_GENERATE, payload, {
    expectedErrorStatuses: [400],
  } as any);
  return response.data;
};

/**
 * Save an AI draft as a real topic.
 * POST /api/topics/ai/create
 */
export const createTopicFromAi = async (payload: CreateAiTopicPayload): Promise<TopicItem> => {
  const response = await axiosClient.post<TopicItem>(ENDPOINTS.TOPICS.AI_CREATE, payload);
  return response.data;
};

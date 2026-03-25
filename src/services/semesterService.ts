import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SerializedSemester {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'UPCOMING' | 'CLOSED';
  current_week: number;
  start_date: string;
  end_date: string;
}

export interface CurrentWeekResponse {
  semester: SerializedSemester | null;
  can_override_week: boolean;
}

// Compliance / warnings

export interface StudentWarning {
  code: 'WEEK1_NO_GROUP' | 'WEEK2_TOPIC_NOT_FINALIZED';
  severity: 'warning';
  class_id: string;
  class_code: string;
  class_name: string;
  group_id?: string;
  group_name?: string;
  message: string;
}

export interface ComplianceGroupSummary {
  group_id: string;
  group_name: string;
  topic_name: string | null;
  has_finalized_topic: boolean;
  week2_status: 'PASS' | 'FAIL';
}

export interface ComplianceClassSummary {
  class_id: string;
  class_code: string;
  class_name: string;
  has_group: boolean;
  week1_status: 'PASS' | 'FAIL';
  groups: ComplianceGroupSummary[];
}

export interface StudentWarningResponse {
  semester: SerializedSemester | null;
  warnings: StudentWarning[];
  classes: ComplianceClassSummary[];
}

// Review status

export interface ReviewMilestoneContext {
  code: 'REVIEW_1' | 'PROGRESS_TRACKING' | 'REVIEW_2' | 'REVIEW_3';
  label: string;
  week_start: number;
  week_end: number;
}

export interface ReviewScores {
  task_progress_score: number | null;
  commit_contribution_score: number | null;
  review_milestone_score: number | null;
  total_score: number | null;
}

export interface ReviewSnapshot {
  task_total: number;
  task_done: number;
  commit_total: number | null;
  commit_contributors: number | null;
  repository: string | null;
  captured_at: string | null;
}

export interface ReviewGroup {
  class_id: string;
  class_code: string;
  class_name: string;
  group_id: string;
  group_name: string;
  topic_name: string | null;
  review_status: 'PENDING' | 'REVIEWED';
  scores: ReviewScores;
  snapshot: ReviewSnapshot;
  warnings: string[];
  lecturer_note: string | null;
  milestone: ReviewMilestoneContext | null;
}

export interface StudentReviewStatusResponse {
  semester: SerializedSemester | null;
  milestone: ReviewMilestoneContext | null;
  groups: ReviewGroup[];
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const getCurrentWeek = async (): Promise<CurrentWeekResponse> => {
  const res = await axiosClient.get<CurrentWeekResponse>(ENDPOINTS.SEMESTERS.CURRENT_WEEK);
  return res.data;
};

export const getStudentWarnings = async (): Promise<StudentWarningResponse> => {
  const res = await axiosClient.get<StudentWarningResponse>(ENDPOINTS.SEMESTERS.STUDENT_WARNINGS);
  return res.data;
};

export const getStudentReviewStatus = async (): Promise<StudentReviewStatusResponse> => {
  const res = await axiosClient.get<StudentReviewStatusResponse>(
    ENDPOINTS.SEMESTERS.STUDENT_REVIEW_STATUS,
  );
  return res.data;
};

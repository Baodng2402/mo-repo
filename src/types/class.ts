export type ClassStatus = 'ONGOING' | 'COMPLETED' | 'ARCHIVED';

export interface ClassItem {
  id: string;
  code: string;
  name: string;
  semester: string | null;
  lecturer_id: string;
  enrollment_key?: string;
  max_groups: number;
  max_students_per_group: number;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
}

export interface JoinClassPayload {
  enrollment_key: string;
}

export interface JoinClassResponse {
  message: string;
}

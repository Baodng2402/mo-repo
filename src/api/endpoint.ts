const ENDPOINTS = {
  CLASSES: {
    LIST: '/api/classes',
    MY_CLASSES: '/api/classes/my-classes',
    JOIN: (id: string) => `/api/classes/${id}/join`,
  },

  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    PROFILE: '/api/auth/me',
    LINK_GITHUB: '/api/auth/github',
    LINK_GITHUB_CALLBACK: '/api/auth/github/callback',
    LINK_JIRA: '/api/auth/jira',
    LINK_JIRA_CALLBACK: '/api/auth/jira/callback',
    LINKED_ACCOUNTS: '/api/auth/linked-accounts',
    UNLINK: (provider: string) => `/api/auth/unlink/${provider}`,
  },

  GITHUB: {
    REPOS: '/api/github/repos',
    CREATE_REPO: '/api/github/repos',
    COMMITS: (owner: string, repo: string) => `/api/github/repos/${owner}/${repo}/commits`,
    CONTRIBUTOR_STATS: (owner: string, repo: string) =>
      `/api/github/repos/${owner}/${repo}/contributors-stats`,
  },

  GROUPS: {
    LIST: '/api/groups',
    CREATE: '/api/groups',
    DETAIL: (id: string) => `/api/groups/${id}`,
    UPDATE: (id: string) => `/api/groups/${id}`,
    DELETE: (id: string) => `/api/groups/${id}`,
    MEMBERS: (id: string) => `/api/groups/${id}/members`,
    ADD_MEMBER: (id: string) => `/api/groups/${id}/members`,
    UPDATE_MEMBER: (id: string, userId: string) => `/api/groups/${id}/members/${userId}`,
    REMOVE_MEMBER: (id: string, userId: string) => `/api/groups/${id}/members/${userId}`,
    LEAVE: (id: string) => `/api/groups/${id}/members/me`,
    BY_CLASS: (classId: string) => `/api/groups/class/${classId}`,
    JOIN_GROUP: (id: string) => `/api/groups/${id}/join`,
    REPOS: (id: string) => `/api/groups/${id}/repos`,
    REPO_COMMITS: (groupId: string, repoId: string) =>
      `/api/groups/${groupId}/repos/${repoId}/commits`,
  },

  JIRA: {
    PROJECTS: '/api/jira/projects',
    LINK_PROJECT: '/api/jira/projects/link',
  },

  TOPICS: {
    LIST: '/api/topics',
    AVAILABLE: '/api/topics/available',
    AI_GENERATE: '/api/topics/ai/generate',
    AI_CREATE: '/api/topics/ai/create',
  },

  EVALUATIONS: {
    LIST: '/api/evaluations',
    CREATE: '/api/evaluations',
    DETAIL: (id: string) => `/api/evaluations/${id}`,
    UPDATE: (id: string) => `/api/evaluations/${id}`,
    DELETE: (id: string) => `/api/evaluations/${id}`,
    MY_CONTRIBUTION: (id: string) => `/api/evaluations/${id}/my-contribution`,
  },

  TASKS: {
    LIST: '/api/tasks',
    DETAIL: (id: string) => `/api/tasks/${id}`,
    CREATE: '/api/tasks',
    UPDATE: (id: string) => `/api/tasks/${id}`,
    DELETE: (id: string) => `/api/tasks/${id}`,
  },

  REPORTS: {
    SRS: (groupId: string) => `/api/reports/srs/${groupId}`,
    COMMITS: (groupId: string) => `/api/reports/commits/${groupId}`,
  },

  DOCUMENTS: {
    GROUP_SUBMISSIONS: (groupId: string) => `/api/documents/group/${groupId}`,
    SUBMIT_FOR_GROUP: (groupId: string) => `/api/documents/group/${groupId}`,
  },

  SEMESTERS: {
    CURRENT_WEEK: '/api/semesters/current-week',
    STUDENT_WARNINGS: '/api/semesters/current/compliance/student-warning',
    STUDENT_REVIEW_STATUS: '/api/semesters/current/reviews/student-status',
  },

  NOTIFICATIONS: {
    LIST: '/api/notifications',
    MARK_READ: (id: string) => `/api/notifications/${id}/read`,
  },

  PROJECT: {
    LIST: '/projects',
    CREATE: '/projects',
    DETAILS: (id: string | number) => `/projects/${id}`,
    ADD_MEMBER: (id: string | number) => `/projects/${id}/members`,
  },

  INTEGRATION: {
    TEST_JIRA: '/integration/jira/test',
    TEST_GITHUB: '/integration/github/test',
  },
} as const;

export default ENDPOINTS;

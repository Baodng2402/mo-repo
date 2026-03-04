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
    LINKED_ACCOUNTS: '/api/auth/linked-accounts',
    UNLINK: (provider: string) => `/api/auth/unlink/${provider}`,
  },

  GITHUB: {
    REPOS: '/api/github/repos',
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

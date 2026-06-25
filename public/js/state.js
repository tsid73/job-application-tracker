export const state = {
  applications: [],
  cvs: [],
  jobBoards: [],
  targetCompanies: [],
  savedFilters: [],
  currentApplication: null,
  currentApplicationDocuments: [],
  currentApplicationJobs: [],
  appConfig: {
    defaultProvider: 'gemini',
    awsEnabled: false
  },
  selectedAIProvider: 'gemini',
  view: 'list',
  route: {
    path: '/',
    applicationId: null,
    documentId: null,
    page: 'home',
    tab: 'overview'
  },
  filters: {
    search: '',
    status: '',
    tag: '',
    archived: 'false'
  },
  selectedIds: new Set(),
  notifications: [],
  notificationsExpanded: false,
  calendarDate: new Date(),
  activity: {
    search: '',
    page: 1,
    limit: 12,
    total: 0,
    selectedIds: new Set()
  },
  targetCompanyFilters: {
    search: '',
    region: '',
    visa: '',
    workMode: '',
    industry: ''
  },
  contentWorkspace: {
    search: '',
    provider: 'all',
    type: 'all',
    previewDocumentId: null,
    recentDocumentId: null,
    latestOnly: false,
    sort: 'newest'
  },
  toasts: []
};

export const statusLabels = {
  applied: 'Applied',
  interview_scheduled: 'Interview Scheduled',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted'
};

export const closedStatuses = new Set(['rejected', 'withdrawn', 'ghosted']);

export function isClosedStatus(status) {
  return closedStatuses.has(status);
}

export const statusOptions = Object.entries(statusLabels)
  .map(([value, label]) => `<option value="${value}">${label}</option>`)
  .join('');

export const state = {
  applications: [],
  cvs: [],
  jobBoards: [],
  savedFilters: [],
  view: 'list',
  filters: {
    search: '',
    status: '',
    tag: '',
    archived: 'false'
  },
  notifications: [],
  calendarDate: new Date(),
  activity: {
    search: '',
    page: 1,
    limit: 12,
    total: 0
  }
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

export const statusOptions = Object.entries(statusLabels)
  .map(([value, label]) => `<option value="${value}">${label}</option>`)
  .join('');

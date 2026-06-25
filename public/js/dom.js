export const els = {
  workspaceRoot: document.querySelector('#workspaceRoot'),
  summary: document.querySelector('#summary'),
  applicationDialog: document.querySelector('#applicationDialog'),
  applicationForm: document.querySelector('#applicationForm'),
  applicationError: document.querySelector('#applicationError'),
  applicationCvSelect: document.querySelector('#applicationCvSelect'),
  applicationEditDialog: document.querySelector('#applicationEditDialog'),
  applicationEditForm: document.querySelector('#applicationEditForm'),
  applicationEditError: document.querySelector('#applicationEditError'),
  detailDialog: document.querySelector('#detailDialog'),
  detailTitle: document.querySelector('#detailTitle'),
  detailContent: document.querySelector('#detailContent'),
  confirmDialog: document.querySelector('#confirmDialog'),
  confirmDialogTitle: document.querySelector('#confirmDialogTitle'),
  confirmDialogBody: document.querySelector('#confirmDialogBody'),
  confirmDialogError: document.querySelector('#confirmDialogError'),
  confirmDialogCancel: document.querySelector('#confirmDialogCancel'),
  confirmDialogAccept: document.querySelector('#confirmDialogAccept'),
  editorDialog: document.querySelector('#editorDialog'),
  editorDialogForm: document.querySelector('#editorDialogForm'),
  editorDialogTitle: document.querySelector('#editorDialogTitle'),
  editorDialogLabel: document.querySelector('#editorDialogLabel'),
  editorDialogInput: document.querySelector('#editorDialogInput'),
  editorDialogError: document.querySelector('#editorDialogError'),
  editorDialogSubmit: document.querySelector('#editorDialogSubmit'),
  promptDialog: document.querySelector('#promptDialog'),
  promptDialogForm: document.querySelector('#promptDialogForm'),
  promptDialogTitle: document.querySelector('#promptDialogTitle'),
  promptDialogLabel: document.querySelector('#promptDialogLabel'),
  promptDialogInput: document.querySelector('#promptDialogInput'),
  promptDialogCancel: document.querySelector('#promptDialogCancel'),
  promptDialogSubmit: document.querySelector('#promptDialogSubmit'),
  cvDialog: document.querySelector('#cvDialog'),
  cvForm: document.querySelector('#cvForm'),
  cvError: document.querySelector('#cvError'),
  cvList: document.querySelector('#cvList'),
  jobBoardDialog: document.querySelector('#jobBoardDialog'),
  jobBoardForm: document.querySelector('#jobBoardForm'),
  jobBoardDialogTitle: document.querySelector('#jobBoardDialogTitle'),
  jobBoardError: document.querySelector('#jobBoardError'),
  jobBoardResetButton: document.querySelector('#jobBoardResetButton'),
  targetCompanyDialog: document.querySelector('#targetCompanyDialog'),
  targetCompanyForm: document.querySelector('#targetCompanyForm'),
  targetCompanyDialogTitle: document.querySelector('#targetCompanyDialogTitle'),
  targetCompanyError: document.querySelector('#targetCompanyError'),
  targetCompanyResetButton: document.querySelector('#targetCompanyResetButton'),
  appToast: document.querySelector('#appToast'),
  importCsvInput: document.querySelector('#importCsvInput'),
  restoreBackupInput: document.querySelector('#restoreBackupInput'),
  workspaceMounted: null
};

const workspaceKeys = [
  'notificationsPanel',
  'search',
  'statusFilter',
  'tagFilter',
  'archiveFilter',
  'savedFilterSelect',
  'savedFilterName',
  'saveFilterButton',
  'deleteFilterButton',
  'quickExportCsvButton',
  'quickExportIcsButton',
  'bulkActionsBar',
  'bulkCount',
  'bulkArchiveButton',
  'bulkRestoreButton',
  'bulkDeleteButton',
  'bulkClearButton',
  'selectAllRows',
  'table',
  'empty',
  'listView',
  'remindersView',
  'kanbanView',
  'reportsView',
  'statsView',
  'activityView',
  'boardsView',
  'companiesView',
  'toolkitView',
  'settingsView',
  'remindersList',
  'kanbanBoard',
  'reportsContent',
  'statsContent',
  'toolkitContent',
  'settingsContent',
  'activitySearch',
  'activityTable',
  'activityEmpty',
  'activityPagination',
  'activityDeleteButton',
  'activitySelectAllCheckbox',
  'jobBoardOpenButton',
  'jobBoardsList',
  'targetCompanyOpenButton',
  'targetCompanySearch',
  'targetCompanyRegionFilter',
  'targetCompanyVisaFilter',
  'targetCompanyWorkModeFilter',
  'targetCompanyIndustryFilter',
  'targetCompaniesList',
  'targetCompaniesSummary',
  'settingsExportCsvButton',
  'settingsImportCsvButton',
  'settingsBackupButton',
  'settingsRestoreButton',
  'settingsRestoreSelectedButton',
  'settingsReplaceBackupButton',
  'settingsClearBackupButton',
  'restoreBackupSelection',
  'restoreBackupFileName',
  'restoreBackupStatus',
  'applicationPageContent',
  'filterToggle',
  'filterPanel',
  'targetCompanyFilterToggle',
  'targetCompanyFilterPanel',
  'dateFromFilter',
  'dateToFilter',
  'resetFiltersButton',
  'activityResetButton'
];

export function bindWorkspaceElements(root = els.workspaceRoot) {
  for (const key of workspaceKeys) els[key] = null;
  if (!root) return els;
  els.notificationsPanel = root.querySelector('#notificationsPanel');
  els.search = root.querySelector('#searchInput');
  els.statusFilter = root.querySelector('#statusFilter');
  els.tagFilter = root.querySelector('#tagFilter');
  els.archiveFilter = root.querySelector('#archiveFilter');
  els.dateFromFilter = root.querySelector('#dateFromFilter');
  els.dateToFilter = root.querySelector('#dateToFilter');
  els.resetFiltersButton = root.querySelector('#resetFiltersButton');
  els.savedFilterSelect = root.querySelector('#savedFilterSelect');
  els.savedFilterName = root.querySelector('#savedFilterName');
  els.saveFilterButton = root.querySelector('#saveFilterButton');
  els.deleteFilterButton = root.querySelector('#deleteFilterButton');
  els.quickExportCsvButton = root.querySelector('#quickExportCsvButton');
  els.quickExportIcsButton = root.querySelector('#quickExportIcsButton');
  els.bulkActionsBar = root.querySelector('#bulkActionsBar');
  els.bulkCount = root.querySelector('#bulkCount');
  els.bulkArchiveButton = root.querySelector('#bulkArchiveButton');
  els.bulkRestoreButton = root.querySelector('#bulkRestoreButton');
  els.bulkDeleteButton = root.querySelector('#bulkDeleteButton');
  els.bulkClearButton = root.querySelector('#bulkClearButton');
  els.selectAllRows = root.querySelector('#selectAllRows');
  els.table = root.querySelector('#applicationsTable');
  els.empty = root.querySelector('#emptyState');
  els.listView = root.querySelector('#listView');
  els.remindersView = root.querySelector('#remindersView');
  els.kanbanView = root.querySelector('#kanbanView');
  els.reportsView = root.querySelector('#reportsView');
  els.statsView = root.querySelector('#statsView');
  els.activityView = root.querySelector('#activityView');
  els.boardsView = root.querySelector('#boardsView');
  els.companiesView = root.querySelector('#companiesView');
  els.toolkitView = root.querySelector('#toolkitView');
  els.settingsView = root.querySelector('#settingsView');
  els.remindersList = root.querySelector('#remindersList');
  els.kanbanBoard = root.querySelector('#kanbanBoard');
  els.reportsContent = root.querySelector('#reportsContent');
  els.statsContent = root.querySelector('#statsContent');
  els.toolkitContent = root.querySelector('#toolkitContent');
  els.settingsContent = root.querySelector('#settingsContent');
  els.activitySearch = root.querySelector('#activitySearchInput');
  els.activityResetButton = root.querySelector('#activityResetButton');
  els.activityTable = root.querySelector('#activityTable');
  els.activityEmpty = root.querySelector('#activityEmptyState');
  els.activityPagination = root.querySelector('#activityPagination');
  els.activityDeleteButton = root.querySelector('#activityDeleteButton');
  els.activitySelectAllCheckbox = root.querySelector('#activitySelectAllCheckbox');
  els.jobBoardOpenButton = root.querySelector('#jobBoardOpenButton');
  els.jobBoardsList = root.querySelector('#jobBoardsList');
  els.targetCompanyOpenButton = root.querySelector('#targetCompanyOpenButton');
  els.targetCompanySearch = root.querySelector('#targetCompanySearchInput');
  els.targetCompanyRegionFilter = root.querySelector('#targetCompanyRegionFilter');
  els.targetCompanyVisaFilter = root.querySelector('#targetCompanyVisaFilter');
  els.targetCompanyWorkModeFilter = root.querySelector('#targetCompanyWorkModeFilter');
  els.targetCompanyIndustryFilter = root.querySelector('#targetCompanyIndustryFilter');
  els.targetCompaniesList = root.querySelector('#targetCompaniesList');
  els.targetCompaniesSummary = root.querySelector('#targetCompaniesSummary');
  els.settingsExportCsvButton = root.querySelector('#settingsExportCsvButton');
  els.settingsImportCsvButton = root.querySelector('#settingsImportCsvButton');
  els.settingsBackupButton = root.querySelector('#settingsBackupButton');
  els.settingsRestoreButton = root.querySelector('#settingsRestoreButton');
  els.settingsRestoreSelectedButton = root.querySelector('#settingsRestoreSelectedButton');
  els.settingsReplaceBackupButton = root.querySelector('#settingsReplaceBackupButton');
  els.settingsClearBackupButton = root.querySelector('#settingsClearBackupButton');
  els.restoreBackupSelection = root.querySelector('#restoreBackupSelection');
  els.restoreBackupFileName = root.querySelector('#restoreBackupFileName');
  els.restoreBackupStatus = root.querySelector('#restoreBackupStatus');
  els.applicationPageContent = root.querySelector('#applicationPageContent');
  els.filterToggle = root.querySelector('#filterToggle');
  els.filterPanel = root.querySelector('#filterPanel');
  els.targetCompanyFilterToggle = root.querySelector('#targetCompanyFilterToggle');
  els.targetCompanyFilterPanel = root.querySelector('#targetCompanyFilterPanel');
  return els;
}

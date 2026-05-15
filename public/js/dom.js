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
  cvDialog: document.querySelector('#cvDialog'),
  cvForm: document.querySelector('#cvForm'),
  cvError: document.querySelector('#cvError'),
  cvList: document.querySelector('#cvList'),
  jobBoardDialog: document.querySelector('#jobBoardDialog'),
  jobBoardForm: document.querySelector('#jobBoardForm'),
  jobBoardDialogTitle: document.querySelector('#jobBoardDialogTitle'),
  jobBoardError: document.querySelector('#jobBoardError'),
  jobBoardResetButton: document.querySelector('#jobBoardResetButton'),
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
  'table',
  'empty',
  'listView',
  'remindersView',
  'kanbanView',
  'reportsView',
  'activityView',
  'boardsView',
  'toolkitView',
  'settingsView',
  'remindersList',
  'kanbanBoard',
  'reportsContent',
  'toolkitContent',
  'settingsContent',
  'activitySearch',
  'activityTable',
  'activityEmpty',
  'activityPagination',
  'jobBoardOpenButton',
  'jobBoardsList',
  'settingsExportCsvButton',
  'settingsImportCsvButton',
  'settingsBackupButton',
  'settingsRestoreButton',
  'applicationPageContent'
];

export function bindWorkspaceElements(root = els.workspaceRoot) {
  for (const key of workspaceKeys) els[key] = null;
  if (!root) return els;
  els.notificationsPanel = root.querySelector('#notificationsPanel');
  els.search = root.querySelector('#searchInput');
  els.statusFilter = root.querySelector('#statusFilter');
  els.tagFilter = root.querySelector('#tagFilter');
  els.archiveFilter = root.querySelector('#archiveFilter');
  els.savedFilterSelect = root.querySelector('#savedFilterSelect');
  els.savedFilterName = root.querySelector('#savedFilterName');
  els.saveFilterButton = root.querySelector('#saveFilterButton');
  els.deleteFilterButton = root.querySelector('#deleteFilterButton');
  els.table = root.querySelector('#applicationsTable');
  els.empty = root.querySelector('#emptyState');
  els.listView = root.querySelector('#listView');
  els.remindersView = root.querySelector('#remindersView');
  els.kanbanView = root.querySelector('#kanbanView');
  els.reportsView = root.querySelector('#reportsView');
  els.activityView = root.querySelector('#activityView');
  els.boardsView = root.querySelector('#boardsView');
  els.toolkitView = root.querySelector('#toolkitView');
  els.settingsView = root.querySelector('#settingsView');
  els.remindersList = root.querySelector('#remindersList');
  els.kanbanBoard = root.querySelector('#kanbanBoard');
  els.reportsContent = root.querySelector('#reportsContent');
  els.toolkitContent = root.querySelector('#toolkitContent');
  els.settingsContent = root.querySelector('#settingsContent');
  els.activitySearch = root.querySelector('#activitySearchInput');
  els.activityTable = root.querySelector('#activityTable');
  els.activityEmpty = root.querySelector('#activityEmptyState');
  els.activityPagination = root.querySelector('#activityPagination');
  els.jobBoardOpenButton = root.querySelector('#jobBoardOpenButton');
  els.jobBoardsList = root.querySelector('#jobBoardsList');
  els.settingsExportCsvButton = root.querySelector('#settingsExportCsvButton');
  els.settingsImportCsvButton = root.querySelector('#settingsImportCsvButton');
  els.settingsBackupButton = root.querySelector('#settingsBackupButton');
  els.settingsRestoreButton = root.querySelector('#settingsRestoreButton');
  els.applicationPageContent = root.querySelector('#applicationPageContent');
  return els;
}

export function createApiRouter(handlers) {
  const routes = [
    route('GET', '/api/health', handlers.health),
    route('GET', '/api/reminders', handlers.getReminders),
    route('GET', '/api/notifications', handlers.getNotifications),
    route('GET', '/api/reports', handlers.getReports),
    route('GET', '/api/activity', handlers.getActivity),
    route('GET', '/api/audit', handlers.getAudit),
    route('GET', '/api/saved-filters', handlers.getSavedFilters),
    route('POST', '/api/saved-filters', handlers.createSavedFilter),
    route('DELETE', /^\/api\/saved-filters\/\d+$/, handlers.deleteSavedFilter, pathId),
    route('GET', '/api/job-boards', handlers.getJobBoards),
    route('POST', '/api/job-boards', handlers.createJobBoard),
    route('PUT', /^\/api\/job-boards\/\d+$/, handlers.updateJobBoard, pathId),
    route('POST', /^\/api\/job-boards\/\d+\/check$/, handlers.checkJobBoard, pathId),
    route('DELETE', /^\/api\/job-boards\/\d+$/, handlers.deleteJobBoard, pathId),
    route('GET', '/api/target-companies', handlers.getTargetCompanies),
    route('POST', '/api/target-companies', handlers.createTargetCompany),
    route('PUT', /^\/api\/target-companies\/\d+$/, handlers.updateTargetCompany, pathId),
    route('POST', /^\/api\/target-companies\/\d+\/check$/, handlers.checkTargetCompany, pathId),
    route('GET', '/api/export/applications.csv', handlers.exportApplicationsCsv),
    route('GET', '/api/export/calendar.ics', handlers.exportCalendar),
    route('GET', '/api/stats', handlers.getStats),
    route('POST', '/api/import/applications', handlers.importApplicationsCsv),
    route('GET', '/api/export/backup', handlers.exportBackup),
    route('POST', '/api/import/backup', handlers.importBackup),
    route('GET', '/api/applications', handlers.getApplications),
    route('GET', '/api/applications/lookup', handlers.lookupApplications),
    route('POST', '/api/applications', handlers.createApplication),
    route('GET', /^\/api\/applications\/\d+$/, handlers.getApplication, pathId),
    route('PUT', /^\/api\/applications\/\d+$/, handlers.updateApplication, pathId),
    route('DELETE', /^\/api\/applications\/\d+$/, handlers.deleteApplication, pathId),
    route('POST', /^\/api\/applications\/\d+\/archive$/, handlers.archiveApplication, pathId),
    route('POST', /^\/api\/applications\/\d+\/restore$/, handlers.restoreApplication, pathId),
    route('POST', /^\/api\/applications\/\d+\/notes$/, handlers.createNote, pathId),
    route('DELETE', /^\/api\/notes\/\d+$/, handlers.deleteNote, pathId),
    route('PUT', /^\/api\/applications\/\d+\/preparation$/, handlers.updatePreparation, pathId),
    route('POST', /^\/api\/applications\/\d+\/recruiter-questions$/, handlers.createRecruiterQuestion, pathId),
    route('POST', /^\/api\/applications\/\d+\/feedback$/, handlers.createFeedbackEntry, pathId),
    route('POST', /^\/api\/applications\/\d+\/todos$/, handlers.createTodo, pathId),
    route('GET', '/api/cv', handlers.getCVs),
    route('POST', '/api/cv', handlers.createCV),
    route('DELETE', /^\/api\/cv\/\d+$/, handlers.deleteCV, pathId),
    route('GET', /^\/api\/cv\/\d+\/download$/, handlers.downloadCV, pathId),
    route('PUT', /^\/api\/recruiter-questions\/\d+$/, handlers.updateRecruiterQuestion, pathId),
    route('DELETE', /^\/api\/recruiter-questions\/\d+$/, handlers.deleteRecruiterQuestion, pathId),
    route('DELETE', /^\/api\/feedback\/\d+$/, handlers.deleteFeedbackEntry, pathId),
    route('PUT', /^\/api\/todos\/\d+$/, handlers.updateTodo, pathId),
    route('DELETE', /^\/api\/todos\/\d+$/, handlers.deleteTodo, pathId),
    route('POST', '/api/ai/generate-cv', handlers.generateCV),
    route('POST', '/api/ai/generate-cover-letter', handlers.generateCoverLetter),
    route('POST', '/api/ai/role-fit', handlers.scoreRoleFit),
    route('POST', '/api/ai/ats-check', handlers.checkATS),
    route('POST', '/api/ai/follow-up-email', handlers.generateFollowUpEmail),
    route('GET', /^\/api\/applications\/\d+\/ai-documents$/, handlers.getApplicationAIDocuments, pathId),
    route('GET', /^\/api\/applications\/\d+\/artifacts\.zip$/, handlers.exportApplicationArtifacts, pathId),
    route('GET', /^\/api\/ai\/documents\/\d+$/, handlers.getAIDocument, pathId),
    route('DELETE', /^\/api\/ai\/documents\/\d+$/, handlers.deleteAIDocument, pathId),
    route('POST', /^\/api\/ai\/documents\/\d+\/regenerate$/, handlers.regenerateAIDocument, pathId),
    route('GET', /^\/api\/ai\/jobs\/\d+$/, handlers.getAIJob, pathId),
    route('GET', /^\/api\/ai\/documents\/\d+\/download$/, handlers.downloadAIDocument, pathId)
  ];

  return async function routeApi(req, res, url) {
    const { method } = req;
    const path = url.pathname;

    for (const item of routes) {
      const match = item.matches(method, path);
      if (!match) continue;
      return item.run(req, res, url, path);
    }

    return handlers.notFound(req, res);
  };
}

function route(method, matcher, handler, paramReader) {
  return {
    matches(requestMethod, path) {
      if (requestMethod !== method) return false;
      if (typeof matcher === 'string') return path === matcher;
      return matcher.test(path);
    },
    run(req, res, url, path) {
      if (paramReader) return handler(req, res, paramReader(path), url);
      return handler(req, res, url);
    }
  };
}

function pathId(path) {
  const match = path.match(/\/(\d+)(?:\/|$)/);
  return Number(match[1]);
}

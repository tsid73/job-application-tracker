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
    route('GET', '/api/export/applications.csv', handlers.exportApplicationsCsv),
    route('POST', '/api/import/applications', handlers.importApplicationsCsv),
    route('GET', '/api/applications', handlers.getApplications),
    route('POST', '/api/applications', handlers.createApplication),
    route('GET', /^\/api\/applications\/\d+$/, handlers.getApplication, pathId),
    route('PUT', /^\/api\/applications\/\d+$/, handlers.updateApplication, pathId),
    route('DELETE', /^\/api\/applications\/\d+$/, handlers.deleteApplication, pathId),
    route('POST', /^\/api\/applications\/\d+\/archive$/, handlers.archiveApplication, pathId),
    route('POST', /^\/api\/applications\/\d+\/restore$/, handlers.restoreApplication, pathId),
    route('POST', /^\/api\/applications\/\d+\/notes$/, handlers.createNote, pathId),
    route('GET', '/api/cv', handlers.getCVs),
    route('POST', '/api/cv', handlers.createCV),
    route('DELETE', /^\/api\/cv\/\d+$/, handlers.deleteCV, pathId),
    route('GET', /^\/api\/cv\/\d+\/download$/, handlers.downloadCV, pathId),
    route('POST', '/api/ai/generate-cv', handlers.generateCV),
    route('POST', '/api/ai/generate-cover-letter', handlers.generateCoverLetter),
    route('POST', '/api/ai/role-fit', handlers.scoreRoleFit),
    route('POST', '/api/ai/ats-check', handlers.checkATS),
    route('POST', '/api/ai/follow-up-email', handlers.generateFollowUpEmail),
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

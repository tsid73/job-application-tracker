const fs = require('fs');
let content = fs.readFileSync('public/js/render.js', 'utf8');

// Hide Saved Filters
content = content.replace('<label>\n              <span>Saved Filter</span>', '<label style="display: none;">\n              <span>Saved Filter</span>');
content = content.replace('<div class="saved-filter-row" hidden>', '<div class="saved-filter-row" style="display: none;" hidden>');

// Export Buttons to Icons
content = content.replace(
  '<button id="quickExportCsvButton" class="secondary" type="button">Export CSV</button>',
  '<button id="quickExportCsvButton" class="icon-button" type="button" title="Export CSV"><i class="bi bi-filetype-csv"></i></button>'
);
content = content.replace(
  '<button id="quickExportIcsButton" class="secondary" type="button">Calendar (.ics)</button>',
  '<button id="quickExportIcsButton" class="icon-button" type="button" title="Calendar (.ics)"><i class="bi bi-calendar-event"></i></button>'
);

// Truncate Col in buildApplicationRow
content = content.replace('<div class="company-cell">', '<div class="company-cell truncate-col">');
content = content.replace('<td>\n      <div class="company-cell truncate-col">', '<td class="truncate-col">\n      <div class="company-cell truncate-col">');

// Remove Archive Button and update SVGs in row actions
const rowActionsRegex = /<div class="row-actions">[\s\S]*?<\/div>/;
content = content.replace(rowActionsRegex, `
      <div class="row-actions">
        <button class="icon-button row-open-btn" type="button" data-detail-id="\${application.id}" aria-label="Open \${escapeHtml(application.company_name)}" title="Open">
          <i class="bi bi-box-arrow-up-right"></i>
        </button>
        <button class="icon-button" type="button" data-edit-row-id="\${application.id}" aria-label="Edit \${escapeHtml(application.company_name)}" title="Edit">
          <i class="bi bi-pencil" style="color: var(--focus)"></i>
        </button>
      </div>`);

// Fix bulk actions icons (rough replace for common svgs if present, otherwise will ignore)
content = content.replace(/<svg[^>]*>[\s\S]*?<\/svg>/g, (match) => {
    if (match.includes('archive')) return '<i class="bi bi-archive" style="color: var(--warn-line)"></i>';
    if (match.includes('trash') || match.includes('delete') || match.includes('1 4 4 4')) return '<i class="bi bi-trash" style="color: var(--danger)"></i>';
    if (match.includes('restore') || match.includes('arrow-clockwise') || match.includes('.7 5.8')) return '<i class="bi bi-arrow-clockwise" style="color: var(--focus)"></i>';
    if (match.includes('x-circle') || match.includes('clear') || match.includes('1 1 1 4 4 4')) return '<i class="bi bi-x-circle"></i>';
    if (match.includes('pencil') || match.includes('edit')) return '<i class="bi bi-pencil" style="color: var(--focus)"></i>';
    return match;
});

// Fix company page: hide summary line and subtitle
content = content.replace(
  '<p>Companies to review regularly for backend and international hiring openings.</p>',
  '<p style="display: none;">Companies to review regularly for backend and international hiring openings.</p>'
);
content = content.replace(
  '<div class="summary-line">',
  '<div class="summary-line" style="display: none;">'
);

// Fix Job Boards page: hide title/subtitle
content = content.replace(
  '<h2>Job Boards</h2>\n        <p>Keep active sourcing portals easily accessible.</p>',
  '<h2 style="display: none;">Job Boards</h2>\n        <p style="display: none;">Keep active sourcing portals easily accessible.</p>'
);
// Convert Job Board buttons to icons
content = content.replace(
  '<button class="secondary" type="button" data-add-job-board>Add Board</button>',
  '<button class="icon-button" type="button" data-add-job-board title="Add Board"><i class="bi bi-plus-lg"></i></button>'
);
content = content.replace(
  '<button class="secondary" type="button" data-add-target-company>Add Company</button>',
  '<button class="icon-button" type="button" data-add-target-company title="Add Company"><i class="bi bi-plus-lg"></i></button>'
);

// Job board actions to icons
const openBtnRegex = /<button class="secondary" type="button" data-board-action="open" data-board-id="\${board.id}">Open<\/button>/g;
content = content.replace(openBtnRegex, '<button class="icon-button" type="button" data-board-action="open" data-board-id="${board.id}" title="Open"><i class="bi bi-box-arrow-up-right"></i></button>');

const editBtnRegex = /<button class="secondary" type="button" data-board-action="edit" data-board-id="\${board.id}">Edit<\/button>/g;
content = content.replace(editBtnRegex, '<button class="icon-button" type="button" data-board-action="edit" data-board-id="${board.id}" title="Edit"><i class="bi bi-pencil" style="color: var(--focus)"></i></button>');

const activeBtnRegex = /<button class="secondary" type="button" data-board-action="toggle-active" data-board-id="\${board.id}">Mark (Active|Inactive)<\/button>/g;
content = content.replace(activeBtnRegex, '<button class="icon-button" type="button" data-board-action="toggle-active" data-board-id="${board.id}" title="Toggle Active"><i class="bi bi-toggle-on"></i></button>');

const deleteBtnRegex = /<button class="secondary" type="button" data-board-action="delete" data-board-id="\${board.id}">Delete<\/button>/g;
content = content.replace(deleteBtnRegex, '<button class="icon-button" type="button" data-board-action="delete" data-board-id="${board.id}" title="Delete"><i class="bi bi-trash" style="color: var(--danger)"></i></button>');

fs.writeFileSync('public/js/render.js', content);
console.log('Render.js fixed via script');

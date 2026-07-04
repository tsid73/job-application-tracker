import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read from PGLITE_DATA_DIR if provided, otherwise default to data/pglite
const envDataDir = process.env.PGLITE_DATA_DIR;
const dataDir = envDataDir ? join(__dirname, '..', envDataDir) : join(__dirname, '..', 'data', 'pglite');

const db = new PGlite(dataDir);
const PORT = 3333;

const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PGlite Database Viewer</title>
    <style>
        :root {
            --bg: #0f172a;
            --bg-panel: #1e293b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent: #3b82f6;
            --accent-hover: #2563eb;
            --border: #334155;
            --success: #10b981;
            --error: #ef4444;
        }
        body {
            margin: 0;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            display: flex;
            height: 100vh;
            overflow: hidden;
        }
        * { box-sizing: border-box; }
        
        #sidebar {
            width: 280px;
            background-color: var(--bg-panel);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            box-shadow: 2px 0 10px rgba(0,0,0,0.2);
            z-index: 20;
        }
        .header {
            padding: 20px;
            border-bottom: 1px solid var(--border);
        }
        .header h1 {
            margin: 0;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
        }
        
        #table-list {
            list-style: none;
            padding: 10px;
            margin: 0;
            overflow-y: auto;
            flex: 1;
        }
        .table-item {
            padding: 12px 15px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 5px;
            font-size: 0.95rem;
            color: var(--text-main);
        }
        .table-item svg {
            color: var(--text-muted);
            transition: color 0.2s ease;
        }
        .table-item:hover {
            background-color: rgba(59, 130, 246, 0.1);
        }
        .table-item:hover svg {
            color: var(--accent);
        }
        .table-item.active {
            background-color: var(--accent);
            color: white;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .table-item.active svg {
            color: white;
        }
        
        #main {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: radial-gradient(circle at top right, #1e293b 0%, #0f172a 100%);
        }
        
        #query-panel {
            padding: 24px;
            background-color: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        textarea {
            width: 100%;
            background-color: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border);
            color: #e2e8f0;
            padding: 16px;
            border-radius: 12px;
            font-family: 'Fira Code', monospace;
            resize: vertical;
            min-height: 100px;
            font-size: 0.95rem;
            line-height: 1.5;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        textarea:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
        }
        .controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        button {
            background-color: var(--accent);
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        button:hover {
            background-color: var(--accent-hover);
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
        }
        button:active {
            transform: translateY(1px);
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        .status {
            font-size: 0.9rem;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        #results-container {
            flex: 1;
            padding: 24px;
            overflow: auto;
        }
        
        .table-wrapper {
            background-color: rgba(30, 41, 59, 0.5);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }
        th, td {
            padding: 14px 20px;
            text-align: left;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        th {
            background-color: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(4px);
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.8rem;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        tbody tr {
            transition: background-color 0.15s;
        }
        tbody tr:last-child td {
            border-bottom: none;
        }
        tbody tr:hover {
            background-color: rgba(255, 255, 255, 0.04);
        }
        .null-val {
            color: var(--text-muted);
            font-style: italic;
        }
        
        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-muted);
            flex-direction: column;
            gap: 16px;
            text-align: center;
            animation: fadeIn 0.5s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #64748b; }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Fira+Code&display=swap" rel="stylesheet">
</head>
<body>

    <div id="sidebar">
        <div class="header">
            <h1>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                PGlite Viewer
            </h1>
        </div>
        <ul id="table-list"></ul>
    </div>

    <div id="main">
        <div id="query-panel">
            <textarea id="sql-input" placeholder="SELECT * FROM table..."></textarea>
            <div class="controls">
                <div class="status" id="status-text">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    Ready
                </div>
                <button onclick="executeQuery()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Run Query
                </button>
            </div>
        </div>
        <div id="results-container">
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--border)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                <p>Select a table from the sidebar or run a custom query to view data.</p>
            </div>
        </div>
    </div>

    <script>
        async function fetchTables() {
            try {
                const res = await fetch('/api/query', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ query: "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema' ORDER BY tablename;" })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                
                const list = document.getElementById('table-list');
                list.innerHTML = '';
                
                data.rows.forEach(row => {
                    const li = document.createElement('li');
                    li.className = 'table-item';
                    li.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>' + row.tablename;
                    li.onclick = () => {
                        document.querySelectorAll('.table-item').forEach(el => el.classList.remove('active'));
                        li.classList.add('active');
                        loadTable(row.tablename);
                    };
                    list.appendChild(li);
                });
            } catch (err) {
                console.error(err);
                const statusText = document.getElementById('status-text');
                statusText.innerHTML = \`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Error loading tables: \${err.message}\`;
                statusText.style.color = 'var(--error)';
            }
        }

        async function loadTable(tableName) {
            const query = \`SELECT * FROM "\${tableName}" LIMIT 100;\`;
            document.getElementById('sql-input').value = query;
            await executeQuery();
        }

        async function executeQuery() {
            const query = document.getElementById('sql-input').value.trim();
            if (!query) return;
            
            const statusText = document.getElementById('status-text');
            statusText.innerHTML = \`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 2s linear infinite"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg> Executing...\`;
            statusText.style.color = 'var(--text-muted)';
            
            const startTime = performance.now();
            
            try {
                const res = await fetch('/api/query', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ query })
                });
                const data = await res.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                const duration = Math.round(performance.now() - startTime);
                statusText.innerHTML = \`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> \${data.rows.length} row(s) returned in \${duration}ms\`;
                statusText.style.color = 'var(--success)';
                
                renderResults(data);
                
            } catch (err) {
                statusText.innerHTML = \`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> \${err.message}\`;
                statusText.style.color = 'var(--error)';
                document.getElementById('results-container').innerHTML = \`
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--error); color: var(--error); padding: 20px; border-radius: 8px; font-family: 'Fira Code', monospace; word-break: break-all;">
                        \${err.message}
                    </div>\`;
            }
        }
        
        function renderResults(data) {
            const container = document.getElementById('results-container');
            
            if (!data.fields || data.fields.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>Query executed successfully. No data returned.</p></div>';
                return;
            }
            
            let html = '<div class="table-wrapper"><table><thead><tr>';
            data.fields.forEach(f => {
                html += \`<th>\${f.name}</th>\`;
            });
            html += '</tr></thead><tbody>';
            
            data.rows.forEach(row => {
                html += '<tr>';
                data.fields.forEach(f => {
                    const val = row[f.name];
                    if (val === null) {
                        html += '<td class="null-val">NULL</td>';
                    } else if (typeof val === 'object') {
                        html += \`<td title='\${JSON.stringify(val).replace(/'/g, "&apos;")}'>\${JSON.stringify(val)}</td>\`;
                    } else {
                        const escaped = String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        html += \`<td title='\${escaped.replace(/'/g, "&apos;")}'>\${escaped}</td>\`;
                    }
                });
                html += '</tr>';
            });
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

        // Initialize
        fetchTables();
        
        // Add style for spinner
        const style = document.createElement('style');
        style.innerHTML = '@keyframes spin { 100% { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    </script>
</body>
</html>
`;

const server = createServer(async (req, res) => {
    // Add CORS headers just in case
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(HTML_CONTENT);
        return;
    }

    if (req.method === 'POST' && req.url === '/api/query') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { query } = JSON.parse(body);
                const result = await db.query(query);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ rows: result.rows, fields: result.fields }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\x1b[36m✨ PGlite Viewer running!\x1b[0m`);
    console.log(`\x1b[32m➜  Local:   http://localhost:${PORT}/\x1b[0m`);
    console.log(`\x1b[90mPress Ctrl+C to stop\x1b[0m`);
});

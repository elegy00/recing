const css = `
:root {
  --accent: #D9665B;
  --bg: #f5f4f0;
  --card-bg: #ffffff;
  --text-primary: #1a1a1a;
  --text-secondary: #737373;
  --border: #e2e0db;
}

* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',system-ui,-apple-system,sans-serif; background:var(--bg); color:var(--text-primary); }

.header { display:flex; align-items:center; justify-content:space-between; height:64px; border-bottom:1px solid var(--border); background:var(--card-bg); padding:0 32px; position:sticky; top:0; z-index:100; }
.logo { font-family:'EB Garamond',Georgia,serif; font-weight:700; font-size:24px; color:var(--text-primary); text-decoration:none; }
.nav a { margin-left:24px; text-decoration:none; color:var(--text-secondary); font-size:15px; transition:color .15s; }
.nav a:hover { color:var(--text-primary); }
.nav .active { color:var(--text-primary); border-bottom:3px solid var(--accent); padding-bottom:19px; margin-bottom:-20px; font-weight:500; }

.container { max-width:860px; margin:0 auto; padding:48px 24px; }
.page-title { font-family:'EB Garamond',Georgia,serif; font-size:32px; font-weight:700; margin-bottom:12px; }
.page-desc { color:var(--text-secondary); line-height:1.5; margin-bottom:32px; max-width:640px; }

.form-card { background:var(--card-bg); border-radius:8px; padding:20px 24px; display:flex; align-items:center; gap:16px; box-shadow:0 1px 3px rgba(0,0,0,.06); border:1px solid var(--border); }
.url-input { flex:1; border:none; outline:none; font-size:15px; color:var(--text-primary); background:transparent; padding:8px 0; }
.url-input::placeholder { color:#b0aea9; font-style:italic; }

.btn { display:inline-flex; align-items:center; justify-content:center; padding:10px 24px; border:none; border-radius:6px; font-size:15px; font-weight:500; cursor:pointer; transition:opacity .15s, transform .1s; }
.btn:hover { opacity:.9; }
.btn:active { transform:scale(.98); }
.btn-primary { background:var(--accent); color:#fff; }

.status-msg { margin-top:16px; font-size:14px; color:var(--text-secondary); font-style:italic; min-height:20px; }

.filters { display:flex; gap:8px; margin-bottom:32px; flex-wrap:wrap; }
.filter-btn { padding:6px 16px; border-radius:999px; border:1px solid var(--border); background:var(--card-bg); color:var(--text-secondary); font-size:14px; cursor:pointer; transition:border-color .15s, color .15s; }
.filter-btn:hover { border-color:#c0beb8; color:var(--text-primary); }
.filter-btn.active { border-color:var(--accent); color:var(--accent); background:#fff6f5; font-weight:500; }

.recipe-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:20px; }

/* Clickable recipe card (for completed recipes) */
.recipe-card-link { text-decoration:none; color:inherit; display:block; }
.recipe-card-link .recipe-card { background:var(--card-bg); border-radius:8px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,.06); border:1px solid var(--border); transition:border-color .15s, box-shadow .15s; position:relative; cursor:pointer; }
.recipe-card-link .recipe-card:hover { border-color:var(--accent); box-shadow:0 2px 8px rgba(217,102,91,.12); }
.recipe-card-link .recipe-name { font-family:'EB Garamond',Georgia,serif; font-size:22px; margin-bottom:4px; word-break:break-word; }
.recipe-card-link .recipe-url { color:var(--text-secondary); font-size:13px; margin-top:8px; word-break:break-all; }

.recipe-name { font-family:'EB Garamond',Georgia,serif; font-size:22px; margin-bottom:4px; word-break:break-word; }
.recipe-url { color:var(--text-secondary); font-size:13px; margin-bottom:16px; word-break:break-all; }

.badge { position:absolute; top:16px; right:16px; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.4px; }
.badge-completed { background:#e8f5e9; color:#2e7d32; }
.badge-pending { background:#fff3e0; color:#e65100; }
.badge-processing { background:#e3f2fd; color:#1565c0; }
.badge-failed { background:#ffebee; color:#c62828; }

.recipe-meta { display:flex; gap:16px; font-size:13px; color:var(--text-secondary); margin-top:12px; padding-top:12px; border-top:1px solid var(--border); }
.delete-btn { position:absolute; top:16px; right:70px; background:none; border:none; color:#c4a98e; cursor:pointer; font-size:16px; transition:color .15s; padding:2px 6px; border-radius:4px; }
.delete-btn:hover { color:var(--accent); background:#fff6f5; }
.reset-btn { display:inline-flex; align-items:center; gap:6px; margin-top:14px; padding:8px 16px; border:1px solid #e65100; border-radius:6px; background:#fff; color:#e65100; font-size:14px; font-weight:500; cursor:pointer; transition:background .15s, color .15s; }
.reset-btn:hover { background:#e65100; color:#fff; }

.empty-state { text-align:center; padding:80px 24px; color:var(--text-secondary); font-size:16px; }
.loading-spinner { display:inline-block; width:16px; height:16px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:spin .6s linear infinite; margin-right:8px; vertical-align:middle; }
@keyframes spin { to { transform:rotate(360deg); } }

.footer { text-align:center; padding:40px 24px; color:#b0aea9; font-size:13px; border-top:1px solid var(--border); margin-top:80px; background:var(--card-bg); }
`;

export default css;

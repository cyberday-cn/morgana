# Modern List Page Design Patterns

Design system used in production Morgana fixed pages (看板 page_8, 需求 page_10, 缺陷 page_12).

## Layout

- Content max-width: `960px` (list-heavy pages) or `720px` (detail/form pages)
- Container centered: `margin: 0 auto; padding: 20px 24px 40px`
- Header sticky with blur effect (see below)

## Header

```css
.header {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 18px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(226,232,240,0.8);
  position: sticky;
  top: 0;
  z-index: 100;
}
.header-icon {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, ...);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
}
.header h1 {
  font-size: 20px; font-weight: 700;
  background: linear-gradient(135deg, #1e293b, #475569);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

Header icon gradients by page theme:
- 看板/需求: `#6366f1` -> `#8b5cf6` (indigo/purple)
- 缺陷: `#ef4444` -> `#f97316` (red/orange)
- General: choose gradient that matches the page purpose

## Buttons

Primary button with hover lift:
```css
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 20px; border: none; border-radius: 8px;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all 0.2s ease;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  box-shadow: 0 1px 3px rgba(99,102,241,0.3);
}
.btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
.btn:active { transform: translateY(0); }
.btn-sm { padding: 7px 14px; font-size: 13px; }
```

Danger button:
```css
.btn-danger { background: linear-gradient(135deg, #ef4444, #f97316); }
```

Outline button:
```css
.btn-outline {
  background: rgba(255,255,255,0.8);
  color: #475569; border: 1px solid #e2e8f0;
}
.btn-outline:hover { background: #f8fafc; border-color: #94a3b8; transform: none; }
```

## Color System

| Role | Value |
|------|-------|
| Page background | `#f0f4ff` |
| Card background | `#ffffff` |
| Primary text | `#1e293b` |
| Secondary text | `#64748b` / `#94a3b8` |
| Brand gradient | `linear-gradient(135deg, #6366f1, #8b5cf6)` |
| Border | `#e2e8f0` / `#f1f5f9` |

## Badge System (CRUD Tables)

### Severity badges
```css
.badge-critical { background: #fef2f2; color: #dc2626; }
.badge-major    { background: #fff7ed; color: #ea580c; }
.badge-minor    { background: #fefce8; color: #a16207; }
.badge-trivial  { background: #f0fdf4; color: #16a34a; }
```

### Priority badges (P0-P3, stored as "P0" in DB)
```css
.badge-p0 { background: #fef2f2; color: #dc2626; }
.badge-p1 { background: #fff7ed; color: #ea580c; }
.badge-p2 { background: #fefce8; color: #a16207; }
.badge-p3 { background: #f8fafc; color: #64748b; }
```

### Status badges (DB values: open, in_progress, resolved, closed, reopened)
```css
.badge-open        { background: #eff6ff; color: #2563eb; }
.badge-in_progress { background: #fefce8; color: #d97706; }
.badge-resolved    { background: #f0fdf4; color: #16a34a; }
.badge-closed      { background: #f8fafc; color: #94a3b8; }
.badge-reopened    { background: #fef2f2; color: #dc2626; }
```

## Table Headers with Sort Icons

```css
th {
  padding: 14px 16px; font-weight: 600;
  color: #64748b; font-size: 13px; letter-spacing: 0.3px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer; user-select: none;
}
th:hover { color: #6366f1; }
th .sort-icon { margin-left: 4px; font-size: 11px; opacity: 0.5; }
th.sorted .sort-icon { opacity: 1; }

td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; }
tr:hover td { background: #f8faff; }
tr.status-done td { opacity: 0.65; }  /* for completed items */
```

## Modal

```css
.modal-overlay {
  background: rgba(15,23,42,0.5);
  backdrop-filter: blur(4px);
}
.modal {
  border-radius: 14px; width: 540px; padding: 28px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
```

## Form Inputs

```css
.form-row input, .form-row select, .form-row textarea {
  padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
  background: #f8fafc; transition: all 0.2s;
}
.form-row input:focus, .form-row select:focus, .form-row textarea:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
  background: #fff;
}
```

## Stat Cards (Table Counters)

```css
.stat-card { background: #fff; border-radius: 10px; padding: 14px 20px;
  flex: 1; min-width: 100px; text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.stat-card .num { font-size: 24px; font-weight: 700; }
.stat-card .label { font-size: 12px; color: #94a3b8; margin-top: 4px; font-weight: 500; }
.stat-card.all .num { color: #6366f1; }
.stat-card.todo .num { color: #3b82f6; }
.stat-card.in-progress .num { color: #f59e0b; }
.stat-card.resolved .num { color: #10b981; }
.stat-card.closed .num { color: #94a3b8; }
```

## Chinese Localization Pattern

For CRUD list pages, all option labels should be displayed in Chinese. DB values stay English.

```javascript
// Mapping objects for display
var SEV_CN = {critical:'严重', major:'主要', minor:'一般', trivial:'轻微'};
var STATUS_CN = {open:'待处理', in_progress:'处理中', resolved:'已解决', closed:'已关闭', reopened:'重新打开'};
```

Dropdown options in both filter toolbar and form selects:
```html
<option value="critical">严重</option>
<option value="major">主要</option>
<option value="minor" selected>一般</option>
<option value="trivial">轻微</option>
```

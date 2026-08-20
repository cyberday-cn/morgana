# Morgana (Mirage)

[English](README.md) | [简体中文](README.zh-CN.md)

---

## 1. Core Concepts

### 1.1 What is Morgana

Morgana is an **AI-driven, Spec-driven dynamic application framework** and a **self-growing end-user product**. Its core proposition: business users don't need to write code — through natural language conversations, an Agent automatically generates usable, evolvable business applications.

#### Dual Perspective

- **As a framework**: Morgana provides two equal core interaction modules — NL (natural language) and UI (graphical interface) — and carries no business attributes of its own. Business capabilities are injected through the AI Agent + capability-unit configuration, so it can host management systems, kanban boards, data tools, and more across any domain.
- **As a product**: aimed at business users (non-developers), the user and Agent collaboratively produce a Spec (application specification) in natural language, and Morgana automatically generates business interfaces, data models, and skills from it. The product grows continuously with the business rather than being a one-time delivery.

#### How It Works

1. **Conversation-driven**: the user talks to the Agent in the NL module, e.g. "I want to manage customer information". The Agent asks clarifying questions (fields, relationships, flows) to gradually converge on requirements.
2. **Spec is the source code**: the conversation produces a structured Spec (application name, data models, pages, operations, skills). The Spec is the single source of truth — interfaces, database tables, and skills are all derived from it.
3. **Automatic generation**: the Agent generates HTML pages (written into the pages service directory), creates database tables (MariaDB), and loads skills on demand. The user uses them directly in the UI module.

#### Page System

The UI module manages two types of pages, forming a complete "from conversation to use" loop:

| Type | Source | Lifecycle |
|------|--------|-----------|
| Emergent page | Generated in real time by the Agent per conversation need (follows the conversation; unique) | Auto-triggered by Agent replies; temporary, tied to the conversation |
| Fixed page | Created by the user, defined by the Spec (linked to a DB table) | Persistent; can be sorted / renamed / shared |

#### Capability Unit Layer

When generating pages, the Agent can combine the following capability units to give pages real business capabilities rather than static displays:

- **Morgana SDK (browser-side)**: executes database CRUD directly inside the page (`Morgana.query/insert/update/delete`) without the need for a custom middle-tier API.
- **Business Skills**: the Agent's reusable behavioral-knowledge base (e.g. kanban drag-and-drop, tree rendering, date handling, PPT generation), injected on demand.
- **Data tools**: the Agent accesses MariaDB data through backend SDK endpoints for queries and changes.
- **External APIs / file attachments**: uploaded files are stored in a shared tmpfile directory and read by the Agent via file paths (images go through a vision model); sharing / screenshot / PPTX rendering capabilities are provided by the backend.

#### Perception-Linkage

The Agent has structured perception of the UI: page state is mirrored into the Agent context (UI State Mirror), user actions are reported as an event stream (UI Event Stream), and the Agent can interact with pages through an action protocol (Action Protocol). Filters, clicks, and submits the user makes on the UI are all perceived and actively responded to by the Agent, achieving a complete loop of "operate on the UI → explained in the conversation → data linkage".

#### Current Implementation

- **Backend**: Express + TypeScript, providing REST + SSE endpoints for tasks / conversations / files / pages / sharing / infrastructure, etc.
- **Frontend**: Vite + React 18 + TypeScript; the NL module (conversation) and UI module (pages) are orchestrated by the Layout Engine.
- **AI Agent**: currently connected to a local Hermes instance (OpenAI-compatible Chat Completions API); Agent configuration is persisted in MariaDB.
- **Data layer**: MariaDB (business data + page metadata + Agent config); page files and uploaded files are stored on the file system.

### 1.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Spec-driven** | All business interfaces, skills, and data models are described by the Spec; the Spec is the single source of truth |
| **Equal modules** | NL and UI are independent, equal modules coordinated through the Agent, rather than embedding each other |
| **User sovereignty** | Fixed pages can only be added / modified / deleted by business admins; the Agent cannot alter them on its own |
| **Perception-linkage** | The Agent has structured perception of UI state and operations, enabling a complete closed loop |
| **Medium-agnostic** | Layouts are pluggable, adapting to desktop, tablet, mobile, wearables, and other form factors |

---

## 2. Overall Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                         Layout Engine                         │
│           Layout modes: Split / NL-focus / UI-focus           │
├─────────────────────────────┬─────────────────────────────────┤
│                             │                                 │
│  ┌────────────────────────┐ │  ┌────────────────────────────┐ │
│  │ Sidebar                │ │  │ PageTabs                   │ │
│  │ Expanded: tabs + tasks │ │  │ [Emergent] [Fixed..] [Edit]│ │
│  │ Collapsed: accordion   │ │  └────────────────────────────┘ │
│  │ (chat/config/page)     │ │                                 │
│  │ ─                      │ │  ┌────────────────────────────┐ │
│  │ Mode switch            │ │  │ PageContent                │ │
│  │ ─                      │ │  │                            │ │
│  │ Account/Setting/Theme  │ │  │ Emergent: iframe → pages   │ │
│  ├────────────────────────┤ │  │ Fixed: iframe → file       │ │
│  │ (Markdown render)      │ │  └────────────────────────────┘ │
│  │                        │ │                                 │
│  │ User ↔ Agent stream    │ │  ┌────────────────────────────┐ │
│  └────────────────────────┘ │  │ Quick-chat popup (UI mode) │ │
│                             │  └────────────────────────────┘ │
│  ┌────────────────────────┐ │                                 │
│  │ Input area (ChatInput) │ │                                 │
│  │ [Input + attachments]  │ │                                 │
│  └────────────────────────┘ │                                 │
│                             │                                 │
└─────────────────────────────┴─────────────────────────────────┘
                 │            │            │                     
                 └────────────┬────────────┘                     
                              │                                  
                              ▼                                  
┌───────────────────────────────────────────────────────────────┐
│                            AI Agent                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ POST /v1/chat/completions (streaming / non-streaming)    │ │
│  │ Local Hermes, endpoint http://127.0.0.1:8899/...         │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
                              │                                  
                              ▼                                  
┌───────────────────────────────────────────────────────────────┐
│                     Capability Unit Layer                     │
│  ┌───────────┐ ┌───────────┐ ┌────────────┐ ┌──────────────┐  │
│  │ Business  │ │ Data      │ │ External   │ │ Morgana SDK  │  │
│  │ skills    │ │ tools     │ │ API        │ │ (browser)    │  │
│  │ (Skills)  │ │ (DB ops)  │ │ integration│ │ submit/query │  │
│  │           │ │           │ │            │ │ insert/      │  │
│  │           │ │           │ │            │ │ update/      │  │
│  │           │ │           │ │            │ │ delete       │  │
│  └───────────┘ └───────────┘ └────────────┘ └──────────────┘  │
└───────────────────────────────────────────────────────────────┘
                              │                                  
                              ▼                                  
┌───────────────────────────────────────────────────────────────┐
│             Backend Service (Express + TypeScript)            │
│  ┌─────────────┐ ┌───────┐ ┌──────────┐ ┌───────────┐         │
│  │ agent-config│ │ tasks │ │ chat     │ │ files     │         │
│  │ (CRUD)      │ │ (CRUD)│ │ (stream) │ │ (upload / │         │
│  │             │ │       │ │          │ │ download) │         │
│  └─────────────┘ └───────┘ └──────────┘ └───────────┘         │
│                                                               │
│  ┌──────────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐  │
│  │ pages        │ │ sdk       │ │ infra-    │ │ share      │  │
│  │ (CRUD + icon │ │ morgana.js│ │ structure │ │ screenshot │  │
│  │ rename/sort) │ │ db query  │ │ config/evt│ │ render-pptx│  │
│  │              │ │ execute)  │ │ events)   │ │            │  │
│  └──────────────┘ └───────────┘ └───────────┘ └────────────┘  │
└───────────────────────────────────────────────────────────────┘
                              │                                  
                              ▼                                  
┌───────────────────────────────────────────────────────────────┐
│                         MySQL Database                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ agent_configs │ tasks (type/page_id) │ messages         │  │
│  │ pages         │ file_attachments                        │  │
│  │ (icon/sort_   │ (original_name/                         │  │
│  │  order/share_ │  stored_name/mime)                      │  │
│  │  token)       │                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ File storage: tmpfile/ (shared, read via WSL path)      │  │
│  │ Page storage: PAGES_ROOT/ (page_<id>.html + index.html) │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

> The architecture diagram above is kept in its original Chinese form. An English version can be provided on request.

---

## 3. Layout Engine

### 3.1 Layout Modes

The NL module and UI module are orchestrated by the Layout Engine for the desktop, supporting three layout modes.

| Mode | Name | Layout | Sidebar state | NL width | Use case |
|------|------|--------|---------------|----------|----------|
| `split` | Split mode | [NL module + draggable divider + UI module] | Keeps current (collapsed by default) | 480px+ (draggable) | Daily work |
| `nl-focus` | NL-focus mode | [NL fullscreen + UI narrow strip] | Auto-expanded (280px) | Adaptive (flex: 1) | Configuration / brainstorming |
| `ui-focus` | UI-focus mode | [Sidebar + UI fullscreen + 💬 floating button] | Auto-collapsed (48px) | Floating button / popup | Data viewing / operations |

### 3.2 NL Module Layout

**NL-focus mode (`nl-focus`)**:
- Chat history: `width: 100%`, 24px left/right padding, covering the entire conversation area
- Input box: `max-width: 720px; margin: 0 auto`, centered rather than full width

**Split mode (`split`)**:
- NL module fixed width (480px by default, adjustable via the draggable divider)
- Chat history: 24px left/right padding
- Input box: 24px left/right padding

### 3.3 Sidebar Behavior

- Collapsible / expandable (48px ↔ 280px)
- **Expanded state**:
  - Logo + "Morgana" title
  - Tab row: [Tasks (text)] [spacer] [⚙️ (icon)] [📄 (icon)] [+ New button]
  - Filters the task list by the currently selected tab (chat/config/page)
  - Each task item shows: first-character icon + title + time marker
  - The selected task shows rename / delete buttons
- **Collapsed state**:
  - Three-segment accordion layout
  - Three sub-lists stacked vertically: chat (+ icon), config (⚙️ icon), page (📄 icon)
  - Only one sub-list is expanded at a time; the expanded area (flex: 1) fills the remaining space
  - The chat sub-list's "+" icon: creates a new task when already on the chat list; switches to the chat list when on another list
- Sidebar state adjusts automatically on mode switch:
  - Switch to NL-focus mode → sidebar expands
  - Switch to UI-focus mode → sidebar collapses
  - Switch to split mode → keeps current state
- **Settings menu**: clicking the "Settings" button expands a secondary menu with two options — "Theme style" and "Agent config"
  - Menu pops downward in the expanded state
  - Menu pops to the right in the collapsed state

---

## 4. NL Module Details

### 4.1 Conversation Management

The NL module manages conversations in **tasks**, each containing one or more conversation turns.

**Task types**:

| Type | Purpose | Source |
|------|---------|--------|
| `chat` | Regular conversation task | User clicks "+" or auto-created |
| `config` | Infrastructure initialization task | Auto-created by the system |
| `page` | Fixed-page linked task | Auto-created when a fixed page is created |

**Task lifecycle**:
1. A task is auto-created when the user clicks "+" or sends the first message (default title "New conversation")
2. The user has multi-turn conversations with the Agent within the task
3. After the first turn completes, a title is auto-generated in the background (5–12 character summary)
4. Tasks can be renamed (double-click the title for inline editing) or deleted

**Task list**:
- Grouped by type: Tasks (chat), Config (config), Pages (page)
- Sorted by last message time, descending within each group
- Each task item shows a time marker (today shows the time, yesterday shows "yesterday", older shows month/day)
- Clicking a task loads its conversation history
- The selected task shows rename and delete buttons

### 4.2 Conversation Flow

#### 4.2.1 Sending Messages

1. The user types text → presses Enter or clicks the send button
2. If there are files to upload, upload first to obtain fileIds
3. The frontend calls `POST /api/chat/stream`, body: `{ taskId, message, fileIds, chatAgentId? }`
4. The backend returns an SSE stream:

```
data: {"type":"user_message","id":1}

data: {"type":"chunk","content":"reply fragment"}

data: {"type":"done","message":{...},"task_title":"(optional)"}

-- or (after the first turn, once the title is generated) --
data: {"type":"task_renamed","task_title":"New title"}
```

#### 4.2.2 SSE Event Types

| Event type | Trigger | Frontend response |
|------------|---------|-------------------|
| `user_message` | User message saved to DB | Reloads the current task's message list |
| `init_started` | Init task starts | Stores initTaskInfo |
| `chunk` | Agent streaming output fragment | Appends to `streamingContent`, renders Markdown live |
| `thinking` | Agent reasoning / heartbeat (3s interval) | Shows thinking state |
| `done` | Agent reply complete | Adds the message to the list, clears streaming content; triggers page generation |
| `task_renamed` | First-turn title generated | Immediately updates the task list title |
| `error` | Error during processing | Shows the error message |

#### 4.2.3 First-Turn Title Generation

- Only triggered when the total message count ≤ 2 (i.e. first-turn user + Agent)
- Sends the first-turn Agent reply and the user question to the Agent API to generate a 4–10 character title
- The returned title is pushed to the frontend via the `task_renamed` event
- On failure, falls back to local extraction (first sentence, max 20 characters)

### 4.3 Message Rendering

**User messages**: plain text, separated by paragraphs.

**Agent messages**: rendered from Markdown to HTML via the `marked` library, supporting:
- Headings (h1–h4), paragraphs, line breaks
- Bold, italic, inline code, code blocks (monospace font)
- Ordered / unordered lists
- Blockquotes
- Tables
- Links, images
- Horizontal rules

**Streaming output**: streaming content is also rendered as Markdown in real time, with a blinking cursor `▍` on the right indicating output in progress.

### 4.4 File Attachments

- Files can be selected via the input box's attachment button, staged as `pendingFiles`, and uploaded together when a message is sent
- Uploaded to `POST /api/files/upload`, returns a fileId, bound to the user message
- Files are stored in the **shared temporary directory** `tmpfile/` (`config.tmpfile.dir`, default `morgana/tmpfile/`, UUID filenames preserving the extension)
- **File reading strategy**: Morgana does not read or inline file contents; instead it appends an `[Attachment]` block to the end of the message, listing each file's original name + MIME type + **WSL path** (`D:\…` → `/mnt/d/…`), letting the Agent read them with its own file-system tools and automatically choose the appropriate model (including vision models)
- **Chinese filenames**: encoding is fixed at upload time via iconv-lite (UTF-8 first, GBK/CP936 fallback), so Chinese names display correctly in conversation history; downloads use RFC 5987 `filename*=UTF-8''…` encoding
- **History display**: images show thumbnails (`/uploads/<stored_name>`), other files show a filename + size chip
- **Cleanup**: when a task is deleted, all of its uploaded files' disk files are removed and `file_attachments` records are cleaned up

### 4.5 Quick Chat in UI Mode

- In UI mode, the NL module appears as a floating button (right of the sidebar)
- Clicking it expands a quick-chat popup (400px wide, 80vh tall)
- The popup includes full chat features: message list, text input, file attachments
- The popup follows the UI content area (auto-shifts right when the sidebar expands)

---

## 5. UI Module

### 5.1 Responsibilities

The UI module is the graphical presentation interface for business data and operations.

- Renders emergent pages (interact) and fixed business pages
- Provides page-switching navigation (PageTabs)
- Responds to user UI operations and reports events to the Agent
- Receives Agent commands to update its own state
- Provides a quick-chat entry point in UI mode

### 5.2 Page Types

| Type | Owner | Lifecycle | Features |
|------|-------|-----------|----------|
| Emergent page | System | Tied to the conversation | Unique; auto-triggered by Agent replies |
| Fixed page | Business admin | Persistent | Defined by the Spec; created/modified/deleted by the user; linked to a DB table |

### 5.3 PageTabs

Located at the top of the UI module, 44px tall.

**Structure**:
- Left: fixed-page tabs (emoji icon + name)
  - The "Emergent" page is fixed first (cannot be deleted or dragged)
  - Other fixed pages can be reordered by dragging in edit mode
- Right: edit button

**Emoji icons (AI semantic matching)**:
- After a fixed page is created, the backend calls the Agent (Hermes) to match the most appropriate emoji icon by page-name semantics (e.g. "drawing" → 🎨, "elephant" → 🐘)
- The frontend polls `GET /api/pages` to get the updated icon (3s first check + 4s × 5 times)
- Falls back to the default icon 📄 when the Hermes call fails
- The endpoint uses `127.0.0.1` (to avoid Windows IPv6 resolution issues), with a 30s timeout (to cover cold start)

**Edit mode**:
- Click the "Edit" button to enter edit mode
- Drag to reorder, double-click to rename, delete fixed pages
- Click the "+" button to create a new fixed page (enter a name and press Enter to submit)
- Click "Save" to exit edit mode
- Renames and reordering are **persisted to the backend in real time**: `PUT /api/pages/:id/rename`, `PUT /api/pages/:id/reorder` (`sort_order` column)

**Page-to-task binding**:
- Creating a fixed page automatically links a `page`-type task; the task title stays equal to the page name (no AI rename)
- Page content is stored under the pages root `PAGES_ROOT/`: `page_<id>.html`
- The pages service runs on a configurable HTTP port (default 3002)

### 5.4 Page Content

**Emergent pages (interact)**:
- Loaded via iframe from `http://localhost:{pagesPort}/?t={cacheBuster}`
- Floating refresh button in the top-right corner (rotating-arrows icon)
- Shows a "Loading page..." indicator while loading
- Page generation is auto-triggered after an Agent reply → SSE notifies the iframe to refresh
- The user can trigger it manually with the "Generate page" button

**Fixed pages**:
- Loaded via iframe from `http://localhost:{pagesPort}/page_{id}.html?t={cacheBuster}`
- When not loaded, shows the page name + a "Page content is dynamically generated by the Agent" placeholder
- Floating refresh button + share button in the top-right corner

### 5.5 Page Sharing

Fixed and emergent pages can be shared with external users for viewing (SharePopover):

- Fixed pages use an **obfuscated share_token** (16-byte random hex, unguessable URL): `http://<LAN-IP>:3001/api/share/page/<token>`
- Emergent pages generate a live link: `http://<LAN-IP>:3002/?t=<cacheBuster>`
- The LAN IP is returned by `GET /api/share/external-ip` (auto-detects the 10.x.x.x subnet)
- The shared page service rewrites `localhost` backend addresses to the LAN IP so the Morgana SDK inside the page works across machines
- Page sharing supports **full-page screenshot download** (Puppeteer headless browser, full-page PNG): `POST /api/share/screenshot`
- The page toolbar in the frontend provides a "Share page" button that opens a share panel to copy the link

### 5.6 Form Interaction

HTML pages generated by the Agent can perform form submission and database operations through the Morgana JS SDK.

**Data flow**:
```
Agent generates HTML (form + Morgana SDK reference)
  → user fills in and submits
  → SDK calls parent.postMessage({ type: 'user_input', data: {...} }, '*')
  → PageContent's message event listener receives it
  → formatted as a "[form submit]" tagged user message
  → calls sendMessage() → POST /chat/stream → Agent continues the conversation
```

**Morgana JS SDK** (`GET /api/sdk/morgana.js`):
- `Morgana.submit(data)` — form submission, sends data back via postMessage
- `Morgana.query(sql, params)` — SELECT query
- `Morgana.insert(sql, params)` — INSERT, returns `{ insertId, affectedRows }`
- `Morgana.update(sql, params)` — UPDATE, returns `{ affectedRows }`
- `Morgana.delete(sql, params)` — DELETE, returns `{ affectedRows }`

### 5.7 Quick Chat

- The floating button is located at the bottom-left of the UI content area (right of the sidebar); clicking it expands a quick-chat window
- The quick-chat window is 80% of the UI content area's height and 400px wide
- The window contains a title bar, message area, and text input
- The button and popup follow the UI content area (auto-shift right when the sidebar expands)

---

## 6. AI Agent

The Agent is Morgana's intelligence core, connecting the NL module, UI module, and capability units.

### 6.1 Connection

Morgana connects to an external AI Agent (local Hermes) via the **OpenAI-compatible Chat Completions API**:

- **Streaming mode** (default): `POST /v1/chat/completions` with `stream: true`, received in real time by the frontend via SSE
- **Non-streaming mode**: `POST /v1/chat/completions` with `stream: false` (title generation, emoji selection, and other background tasks)
- **Current Agent**: local Hermes (API Server protocol), endpoint `http://localhost:8899/v1/chat/completions`
- **Connection notes**: on Windows, `localhost` resolves to IPv6 `[::1]`, which can cause connection failures; use `127.0.0.1` instead. Background tasks (title/icon) use a 30–45s timeout to cover model cold start

### 6.2 Agent Configuration

Users can configure connection parameters through the sidebar's "Settings → Agent config" dialog.

**Config fields**:

| Field | Type | Description |
|-------|------|-------------|
| Name | string | Identifier of the Agent config |
| Protocol type | enum | `acp` or `api-server` |
| Endpoint URL | string | Full URL of the Agent service |
| API Key | string? | Optional authentication key |
| Description | string? | Config description |
| Active | boolean | The Agent currently in use (only one can be active) |
| Initialized | boolean | Infrastructure initialization status |
| Init prompt | string? | Custom init System Prompt |
| Chat prompt | string? | Custom chat System Prompt |
| Page prompt | string? | Custom fixed-page generation System Prompt |
| Emerge prompt | string? | Custom emergent-page generation System Prompt |

**System Prompt system**:

| Level | Purpose | Priority |
|-------|---------|----------|
| `init_prompt` | Init phase (set up the pages service) | Custom > built-in default |
| `chat_prompt` | Normal conversation (Agent replies) | Custom + env config > env config only |
| `page_prompt` | Fixed-page generation (triggered by page-type tasks) | Custom + env config > env config only |
| `emerge_prompt` | Emergent-page generation (button / auto-trigger) | Custom > chat prompt > built-in default |

**The chat System Prompt environment config includes**:
- The pages service port
- The page refresh callback endpoint (`GET /api/infrastructure/refresh`)
- The Morgana JS SDK URL

### 6.3 Core Capabilities

#### Intent Understanding
Parses the user's natural language input into structured intent, deciding the next action.

#### Modality Arbitration
Decides the interaction form based on the current scenario:
- View / browse → UI-led
- Input / configuration → UI-led (forms)
- Vague exploration → NL-led
- Action / confirmation → NL + lightweight UI

#### Spec Compiler
Produces a Spec collaboratively with the user in conversation, then:
1. Generates UI pages (page structure and layout schema)
2. Generates Skills (sets of business-operation tools)
3. Generates database table structures (as needed)

#### UI Perception and Control
See Section 8, "Perception-Linkage Protocol".

### 6.4 Initialization Flow

1. The user activates an Agent config
2. Click "Initialize" to create an init task (`type: config`)
3. The backend sends `init_prompt` or the built-in default init prompt to the Agent
4. The Agent sets up the pages service (HTTP service, directory structure, test page)
5. The Agent calls `PUT /api/infrastructure/config` to report the page config (or calls `GET /api/infrastructure/refresh` to only trigger a refresh)
6. The backend broadcasts the `page_refresh` SSE event → the frontend refreshes the iframe
7. Marks `initialized: true` once initialization is complete

### 6.5 Page Generation Flow

**Emergent pages (chat tasks)**:
1. After the Agent reply finishes, the frontend automatically calls `POST /api/chat/generate-page` (or the user clicks the "Generate page" button)
2. The backend sends the conversation context to the Agent (using emerge_prompt/chat_prompt), triggering page generation
3. The Agent writes `index.html` in the `pages/` directory
4. The Agent calls `GET /api/infrastructure/refresh` → the backend broadcasts the `page_refresh` SSE event → the frontend reloads the iframe
5. Cancellation is supported (on cancel, sets `_skipNextPageRefresh = true` to suppress refresh events within 12s)

**Fixed pages (page tasks)**:
1. The conversation takes place in a `page`-type task linked to a fixed page
2. The System Prompt injects the fixed-page filename (`page_<id>.html`)
3. The Agent generates the page content and writes it to `page_<id>.html`
4. The Agent calls the refresh callback to notify the frontend to load
5. The task title always equals the page name (page-type tasks don't call Hermes for title generation, avoiding ambiguity with the page name)

---

## 7. Spec Language

### 7.1 Positioning

The Spec is Morgana's "single source of truth". It is produced collaboratively by the user and the Agent; one App, one Spec.

### 7.2 Format

The Spec uses **Markdown**, structurally describing all of the application's business content.

### 7.3 Structure Draft

```markdown
# {Application Name}

## Data Models

### {Model Name}
- {field name}: {type} [{constraint}]
  - e.g. name: string [required]
  - e.g. created_at: datetime [auto]

## Pages

### {Page Name} [{type}]
- Type: table | form | chart | kanban | custom
- Data source: {data model}

#### Layout
{layout description of the page}

#### Actions
- {action name}: {trigger condition} → {executed skill}

## Skills

### {Skill Name}
- Trigger: "{natural-language trigger phrase}"
- Description: {skill description}
- Action: {data-tool invocation}
```

> **Note**: the exact Spec format will be finalized in a later iteration; this is currently a concept draft.

---

## 8. Perception-Linkage Protocol

The Agent and UI module communicate through three structured channels.

### 8.1 UI State Mirror

The UI module maintains a structured, semantic state tree that the Agent can read at any time.

```json
{
  "currentPage": "Customer List",
  "pages": {
    "Customer List": {
      "type": "table",
      "dataSummary": { "rows": 25, "selectedId": "Zhang San" },
      "state": { "filters": { "level": "VIP" }, "sort": "created_at desc" }
    }
  }
}
```

- The state is **semantic**, not pixel/DOM level
- The Agent uses this channel to understand what is "happening" in the UI

### 8.2 UI Event Stream

User operations on the UI are pushed to the Agent as structured events.

```json
{
  "type": "row_select | filter_change | sort_change | chart_click | page_switch | button_click",
  "source": "Customer List",
  "payload": { "...": "..." },
  "timestamp": "2026-06-11T10:30:00Z"
}
```

The Agent can respond to events immediately (via NL module output or by operating the UI through the Action Protocol).

### 8.3 Action Protocol

The Agent controls the UI through structured commands.

| Command | Parameters | Effect |
|---------|------------|--------|
| `navigate` | page, params | Switches to the specified page, preloads data |
| `updateComponent` | page, state | Partially refreshes component state (filters/data/sort) |
| `notify` | message, level | Shows a notification |
| `confirm` | message | Shows a confirmation dialog |
| `refresh` | page | Refreshes the page data |

### 8.4 Shared Data Layer

The data shown in the UI comes from the Data Context — a shared data space managed by the Agent:

```
Agent queries → Data Context → UI rendering layer reads → displayed
                                  ↑
User operations → Event Stream → Agent perceives → re-queries → updates Data Context
```

---

## 9. Data Layer

### 9.1 Layered Storage
```
┌─────────────────────────────────┐
│Agent short-term memory          │
│(session context, lost on end)   │
├─────────────────────────────────┤
│Agent working memory             │
│(vector DB / RAG)                │
├─────────────────────────────────┤
│Business persistence             │
│(relational DB, schema from Spec)│
└─────────────────────────────────┘
```

### 9.2 Backend Services

Morgana's backend is an Express + TypeScript service providing REST APIs.

**Backend project structure**:

```
backend/
  config/
    default.json              # config file (database, server port, shared temp dir)
  tmpfile/                    # shared temp file dir (shared between Windows and Hermes/WSL)
  src/
    index.ts                  # entry point, Express server startup
    config.ts                 # config loader (supports env var overrides)
    db.ts                     # MySQL pool + auto table creation + safe migrations
    routes/
      agent-config.ts         # Agent config CRUD + activate + init + default prompts
      tasks.ts                # task CRUD (supports type/pageId) + message loading
      chat.ts                 # chat proxy (streaming/non-streaming/Runs) + page generation
      files.ts                # file upload/download (stored in the shared tmpfile dir)
      pages.ts                # fixed-page CRUD + rename/reorder/share token + emoji semantic matching
      share.ts                # page sharing (LAN IP detection, Puppeteer screenshot, share page service)
      render-pptx.ts          # PPTX rendering (LibreOffice headless → PNG base64)
      sdk.ts                  # Morgana JS SDK + database query/execute endpoints
      infrastructure.ts       # infra config get/update + SSE event stream + page refresh
    services/
      chat-proxy.ts           # Agent proxy service (builds 4 system prompts, streaming forwarding,
                              # title generation, page-generation trigger, cancel, refresh suppression,
                              # attachment path injection)
```

**API routes**:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/agent-configs | List Agent configs |
| POST | /api/agent-configs | Create an Agent config |
| GET | /api/agent-configs/:id | Get a single config |
| PUT | /api/agent-configs/:id | Update an Agent config |
| DELETE | /api/agent-configs/:id | Delete an Agent config |
| POST | /api/agent-configs/:id/activate | Activate an Agent config |
| POST | /api/agent-configs/:id/init | Initialize an Agent (creates an init task) |
| POST | /api/agent-configs/:id/init-complete | Mark initialization complete (Agent callback) |
| GET | /api/agent-configs/:id/default-init-prompt | Get the default init prompt |
| GET | /api/agent-configs/:id/default-chat-prompt | Get the default chat prompt |
| GET | /api/agent-configs/:id/default-page-prompt | Get the default page prompt |
| GET | /api/agent-configs/:id/default-emerge-prompt | Get the default emerge prompt |
| GET | /api/tasks | Task list (includes last_message_at, sorted by type) |
| POST | /api/tasks | Create a task (supports type/pageId) |
| GET | /api/tasks/:id | Get a single task |
| PUT | /api/tasks/:id | Update a task title |
| DELETE | /api/tasks/:id | Delete a task (cascade-deletes messages) |
| GET | /api/tasks/:id/messages | Get a task's message list |
| POST | /api/chat/stream | Streaming chat (SSE, supports chatAgentId/initAgentId) |
| POST | /api/chat/completions | Non-streaming chat (legacy) |
| POST | /api/chat/run | Runs API mode (legacy, not currently used) |
| POST | /api/chat/generate-page | Trigger emergent-page generation (fire-and-forget) |
| POST | /api/chat/generate-page/cancel | Cancel page generation |
| POST | /api/files/upload | Upload a file (multipart, stored in the shared tmpfile dir) |
| GET | /api/files/:id | Preview a file (returned inline) |
| GET | /api/files/:id/download | Download a file (preserves the original filename, RFC 5987 encoding) |
| GET | /api/pages | Page list (sorted by sort_order) |
| POST | /api/pages | Create a fixed page (auto-creates a linked task, page file, and share token; Hermes matches emoji in the background) |
| PUT | /api/pages/:id/rename | Rename a page |
| PUT | /api/pages/:id/reorder | Reorder pages (updates sort_order) |
| GET | /api/pages/:id/share-token | Get a page's share token |
| PUT | /api/pages/migrate-icons | Rebuild all page emoji icons via Hermes semantic matching |
| DELETE | /api/pages/:id | Delete a page (deletes the page file and cascade-deletes the linked task) |
| GET | /api/share/external-ip | Get the LAN IP (10.x.x.x) for building share links |
| POST | /api/share/screenshot | Puppeteer full-page screenshot (returns PNG base64 + page title) |
| GET | /api/share/page/:token | Share a fixed page (looked up by random share_token; rewrites backend addresses to the LAN IP) |
| POST | /api/render-pptx | Render PPTX (receives base64, LibreOffice → PNG, returns a slides array) |
| GET | /api/infrastructure/config | Get infrastructure config |
| PUT | /api/infrastructure/config | Update infrastructure config (triggers a page refresh broadcast) |
| GET | /api/infrastructure/refresh | Trigger a page refresh (does not modify config; broadcasts SSE after the call) |
| GET | /api/infrastructure/events | SSE event stream (page refresh notifications) |
| GET | /api/sdk/morgana.js | Morgana browser SDK (submit/query/insert/update/delete) |
| POST | /api/sdk/db/query | SDK database query (SELECT only) |
| POST | /api/sdk/db/execute | SDK database execution (INSERT/UPDATE/DELETE) |
| GET | /api/health | Health check |

### 9.3 Configuration

Database and server configuration is stored in `backend/config/default.json`:

```json
{
  "server": { "port": 3001 },
  "db": {
    "host": "localhost",
    "port": 3306,
    "database": "morgana",
    "user": "root",
    "password": ""
  },
  "pages": {
    "root": "./pages",
    "port": 3002
  },
  "tmpfile": {
    "dir": ""
  }
}
```

Config can be overridden via environment variables:

| Config key | Environment variable | Default |
|------------|----------------------|---------|
| `server.port` | `SERVER_PORT` | 3001 |
| `db.host` | `DB_HOST` | localhost |
| `db.port` | `DB_PORT` | 3306 |
| `db.database` | `DB_DATABASE` | morgana |
| `db.user` | `DB_USER` | root |
| `db.password` | `DB_PASSWORD` | (empty) |
| `pages.root` | `PAGES_ROOT` | `./pages` |
| `pages.port` | `PAGES_PORT` | 3002 |
| `tmpfile.dir` | `TMPFILE_DIR` | `<project root>/tmpfile` (shared between Windows and Hermes/WSL) |

Infrastructure config can be updated dynamically via `PUT /api/infrastructure/config` (persisted to `env.conf`).

### 9.4 Database Schema

**agent_configs**: Agent connection configs

```sql
CREATE TABLE agent_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  protocol ENUM('acp', 'api-server') NOT NULL DEFAULT 'acp',
  endpoint VARCHAR(500) NOT NULL,
  api_key VARCHAR(500) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 0,
  initialized TINYINT(1) DEFAULT 0,
  init_prompt TEXT DEFAULT NULL,
  chat_prompt TEXT DEFAULT NULL,
  page_prompt TEXT DEFAULT NULL,
  emerge_prompt TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**tasks**: conversation tasks (with type and page_id)

```sql
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  type ENUM('chat','config','page') DEFAULT 'chat',
  page_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**messages**: conversation messages

```sql
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  role ENUM('user','agent') NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

**pages**: fixed-page metadata

```sql
CREATE TABLE pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  icon VARCHAR(50) DEFAULT '📄',
  task_id INT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  share_token VARCHAR(32) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
```

- `icon`: page tab emoji icon, generated by Hermes via semantic matching on the page name (updated asynchronously in the background)
- `sort_order`: page sort index, persisted after drag-reorder
- `share_token`: random 32-hex share token (16 bytes); share links are unguessable

**file_attachments**: uploaded-file records

```sql
CREATE TABLE file_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT DEFAULT NULL,
  original_name VARCHAR(500) NOT NULL,
  stored_name VARCHAR(200) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);
```

### 9.5 Database Access Principles

The Agent does **not execute raw SQL directly**. It interacts with the database through the Morgana SDK's database endpoints:

```
Agent generates an HTML page → page JS calls Morgana.query/insert/update/delete
  → fetch http://localhost:3001/api/sdk/db/{query|execute}
  → backend validates params (query only SELECT, execute only INSERT/UPDATE/DELETE)
  → executes SQL → returns the result
```

The SDK database endpoints enforce SQL type validation:
- `POST /api/sdk/db/query` — accepts SELECT statements only
- `POST /api/sdk/db/execute` — accepts INSERT / UPDATE / DELETE statements only

---

## 10. Design System

### 10.1 Theme System

Dark/light dual themes are supported, toggled via the `data-theme` attribute on `<html>`. All colors are defined as CSS custom properties and cascade automatically on theme switch.

- **Dark theme**: dark gray background (#0c0c14) with white text
- **Light theme**: light gray background (#f4f5f7) with dark text

### 10.2 Color System

- **Accent**: indigo (#6366f1), modern and clean
- **Frosted glass**: semi-transparent backgrounds layered over dark/light backgrounds
- **Layers**: `--bg-deep` → `--bg-surface` → `--bg-elevated` (dark to light)
- **Text layers**: `--text-primary` (92%) → `--text-secondary` (60%) → `--text-tertiary` (30%)

### 10.3 Component Styles

- **Sidebar**: 6px rounded corners, collapsible (48px/280px), frosted-glass hover effect
  - Expanded: tabs-row + flat task list
  - Collapsed: three-segment accordion (chat/config/page), only the current selection expanded
- **Chat bubbles**: max width 80%; Agent bubbles have dark/white backgrounds, user bubbles use the indigo accent
- **Markdown content**: code blocks with dark background and monospace font, tables with borders, blockquotes with a left vertical bar
- **Streaming output**: blinking cursor `▍` on the right, content rendered as Markdown in real time
- **Page tabs**: 44px tall, icon + name, indigo accent when selected
  - The emergent page is fixed on the left; cannot be deleted or dragged
  - In edit mode: drag to reorder, rename, delete fixed pages
- **Fixed-page container**: position relative, floating refresh button (12px icon, top-right)
- **Emergent-page container**: same as fixed pages; shows "Loading page..." while loading
- **Floating button**: 48px circle, indigo gradient, hover shadow
- **Quick-chat dialog**: 400px wide, 80vh tall, float-in animation, pops from the bottom-left
- **Animations**: `floatIn`, `fadeIn`, `slideIn` CSS animations with ease-out curves
- **ThemeDialog**:
  - Choose between theme styles (multiple preset palettes)
  - Dark/light mode toggled independently
  - Takes effect immediately, persisted to localStorage

### 10.4 Theme Switching

- Open ThemeDialog via Settings menu → "Theme style"
- Quick dark/light toggle button at the bottom of the sidebar
- All CSS variables take effect immediately on switch, no refresh needed
- Layout mode (`morgana-layout`) and theme preference are persisted to localStorage

---

## 11. Frontend Project Structure

```
frontend/
  src/
    types/index.ts              # TypeScript type definitions (TaskType, Page, FileAttachment, AgentConfig, InfrastructureConfig, etc.)
    theme/index.ts              # theme definitions (palettes, preset theme list)
    stores/
      useLayoutStore.ts         # layout state (mode, theme, color scheme)
      useNLStore.ts             # NL module state (task list, messages, streaming chat, page generation)
      useUIStore.ts             # UI module state (page list, selected tab, edit mode, page CRUD, drag-reorder)
      useAgentStore.ts          # Agent config state (configs CRUD, infrastructure config)
    components/
      layout/
        LayoutEngine.tsx         # layout engine (three-mode orchestration)
        DesktopSplit.tsx         # desktop split mode (NL + UI side by side)
        NLFocus.tsx              # NL-focus mode
        UIFocus.tsx              # UI-focus mode
        NLModule.tsx             # NL module container
      nl/
        ChatHistory.tsx          # conversation history list
        ChatMessage.tsx          # single message (Markdown + attachment rendering + generate-page button)
        ChatInput.tsx            # input box + attachment upload
        Sidebar.tsx              # sidebar (expand/collapse, task list, mode switching, account/settings)
        MarkdownRenderer.tsx     # Markdown rendering component
        AgentConfigDialog.tsx    # Agent config dialog (init/chat/page/emerge prompt sets)
        ThemeDialog.tsx          # theme selection dialog
      ui/
        UIModule.tsx             # UI module container (PageTabs + PageContent)
        PageTabs.tsx             # page tab bar (emergent + fixed-page tabs + edit/rename/reorder/delete + share button)
        PageContent.tsx          # page content area (emergent/fixed pages + iframe + postMessage listener)
        SharePopover.tsx         # page share popover (get LAN IP, copy share link, screenshot preview)
        FloatingNLButton.tsx     # floating button in UI mode
        QuickChatPopup.tsx       # quick-chat popup
      common/
        Logo.tsx                 # brand logo component
    index.css                    # global styles (CSS custom properties, component styles, theme variables)
```

---

## 12. Interaction Scenarios

### Scenario: A business admin creates a customer management system

```
User: I want to manage customer information
Agent: Sure, what fields does a customer need?
User: Name, phone, level, source, notes
Agent: Understood. I suggest adding an automatic "created_at" timestamp.
       Once you confirm, I'll generate the customer management page and database table for you.
User: OK
Agent: [generate Spec → generate UI → generate DB table]

The user now sees the customer list page and adds some records.
A few days later...

User: Add a "last contacted time" field
Agent: Sure, let me enter edit mode and add it for you.
       [switch to edit/maintenance mode → user confirms → update Spec → update UI]
```

### Scenario: Perception-linkage in daily use

```
The user clicks the VIP filter tab on the UI.

Event → Agent perceives: { type: "filter_change", filter: {level: "VIP"} }
Agent reasons: the user wants to see only VIP customers
Agent queries: query_records("customers", {level: "VIP"})
Agent updates the Data Context → UI refreshes
Agent says in the NL module: "15 VIP customers filtered"
```

### Scenario: Agent collects information via a form

```
User: Help me analyze the sales data
Agent: Sure, I need some information to tailor the analysis. Let me generate a form page.

[Agent generates an HTML page with a form, referencing the Morgana SDK]
The page has: time-range picker, analysis dimension, chart type selector

User: selects "Jan–Jun 2026", "by product category", "bar chart" → submit

[form data is sent back to the conversation via postMessage]
In the conversation: [form submit]
Time range: Jan–Jun 2026
Analysis dimension: by product category
Chart type: bar chart

Agent: Here is the sales analysis by product category for the first half of 2026...

[Agent also generates a page displaying the analysis results]
```

---

## 13. Open Questions (to be discussed)

1. **Multi-tenancy / multi-user** — should a single Morgana instance support multiple users with isolated data? How should the permission model and data isolation be designed?
2. **Security** — permission model, data isolation, and Agent behavior boundaries (share links currently use a random share_token to prevent guessing; permission controls are not yet refined)



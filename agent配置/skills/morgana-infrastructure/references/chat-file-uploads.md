# Morgana Chat File Uploads — How They Flow & the Image/Vision Gap

Session finding (2026-07-20): user uploaded an image in a Morgana chat task, spinner ran
forever with no reply. Root cause traced to `buildMessages()` in
`backend/src/services/chat-proxy.ts`.

## Upload flow (verified against DB + filesystem)

1. Frontend uploads the file → stored in `backend/uploads/<uuid>.<ext>`, row inserted
   into `file_attachments`.
2. `POST /api/chat/stream|run` with `fileIds` → `saveUserMessage()` then
   `attachFiles()` sets `file_attachments.message_id`.
3. `buildMessages()` (chat-proxy.ts ~lines 122-155) turns each file into a **text
   context block** appended to the last user message.
4. The composed messages go to the active agent (Hermes API at
   `http://localhost:8899/v1/chat/completions`, model `hermes`, stream true).

## `file_attachments` schema (no task_id column!)

```
id, message_id, original_name, stored_name, mime_type, file_size, created_at
```
Join to tasks via `messages.id = file_attachments.message_id`. Do NOT query
`task_id` on this table — it doesn't exist (pymysql error 1054).

## The image/vision gap (root cause of "uploaded image, no reply")

`buildMessages()` classifies files by mime/extension:

- Text-like (`text/*`, json, md, csv, code files…): file content is read and inlined
  as `=== FILE: name ===\n<content>\n=== END FILE ===` — works fine.
- **Everything else (including `image/*`): only a placeholder line is appended:**
  `[File: 222.png (image/png) — attached]`

So the model receives NO image bytes, NO base64, NO vision content parts — just a
sentence saying a file exists. The agent can only hallucinate or stall. Symptom seen:
long spinner, then nothing returned (task had user messages 917/918 with image
attached, no agent reply in DB).

## Key facts for a future fix

- Backend modification is FORBIDDEN by the morgana-infrastructure skill
  (⛔ 铁律：禁止修改 `backend/src/`). If the user ever lifts that rule or wants a
  workaround, the fix point is `buildMessages()` non-text branch: read the file,
  base64-encode, emit an OpenAI vision content part
  `{type:'image_url', image_url:{url:'data:<mime>;base64,...'}}` in the user message,
  and confirm the active model actually supports vision (current k3 does;
  GLM-5V-Turbo config also exists).
- Verification recipe after any fix: upload image in a chat task → check
  `messages` table gets an agent row → check content describes the actual image.
- Uploaded files are directly viewable for diagnosis:
  `<PROJECT_ROOT>/backend/uploads/<stored_name>` can be fed to
  vision_analyze to see what the user actually sent.

## Diagnostic checklist used (reusable)

1. DB: latest `messages` for the task — user rows present? agent row missing?
2. DB: `file_attachments` rows linked to those message ids — mime_type tells you if
   it was an image.
3. Filesystem: confirm the stored file exists and matches size (`ls -la uploads/`).
4. Read `buildMessages()` — confirm which branch the mime type hits.
5. Probe the agent endpoint directly:
   `curl -X POST http://localhost:8899/v1/chat/completions` → `401` without the
   bearer key is EXPECTED (gateway requires the api_key from `agent_configs`).
   A 401 means the gateway is UP; don't misread it as the failure.

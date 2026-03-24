# FirewallAI — Implementation Guide for AI Agent
## All Changes Required to Implement the 3 New Features

---

## OVERVIEW OF CHANGES

### Feature 1: Real pfSense Log Filtering (replacing dummy data)
### Feature 2: Cybersecurity Expert Chatbot
### Feature 3: Vulnerability/CVE News Feed with Article View + Chat Integration

---

## DIAGNOSIS: LOG FILTERS ARE USING DUMMY DATA

**Evidence found in `scripts/ubuntu/server_v2.js` line ~500+:**

```javascript
app.get('/api/logs/search', async (req, res) => {
    // ...
    if (!config.elasticsearch.enabled) {
        // Return mock data if ES not configured
        return res.json({
            logs: generateMockLogs(parseInt(size)),  // <-- DUMMY DATA
            total: 500,
            source: 'mock'
        });
    }
```

The `generateMockLogs()` function generates random IPs, random ports, random actions.
The frontend `LogsPage.tsx` builds query params but they're never applied to real data.
Even the Elasticsearch path has fallback to `generateMockLogs()` on any error.

**FIX:** SSH into pfSense directly and parse `clog /var/log/filter.log`.

---

## FILE-BY-FILE CHANGES

### 1. BACKEND: `scripts/ubuntu/server_v2.js`

**Add these new routes** (paste before the "Start Server" section):
- Copy the contents of `new_api_routes.js` from this package
- This adds 3 new endpoints:
  - `GET /api/logs/search` (REPLACE existing — now SSHs into pfSense)
  - `GET /api/vulnerabilities` (NVD API proxy with 2h cache)
  - `GET /api/vulnerabilities/:cveId` (single CVE lookup)
  - `POST /api/chat` (AI chatbot with session memory)
  - `DELETE /api/chat/:sessionId` (clear chat history)

**IMPORTANT:** The EXISTING `/api/logs/search` route must be REPLACED, not duplicated.
Search for `app.get('/api/logs/search'` in server_v2.js and replace the entire route handler.

Also add near the top of server_v2.js (after existing require statements):
```javascript
// No new npm dependencies needed — uses existing axios, node-ssh, groq-sdk
```

### 2. FRONTEND: `src/app/components/LogsPage.tsx`

**REPLACE ENTIRELY** with the new `LogsPage.tsx` from this package.

Key changes:
- Removed all client-side mock data generation
- Added 15-second auto-refresh with visible countdown
- Added data source badge (shows "pfSense Live", "Elasticsearch", or "Demo Data")
- Filters now pass `action` and `protocol` as separate query params to backend
- Backend does the actual filtering (not frontend string building)
- Added direction and rule_id columns
- Pause/resume auto-refresh toggle

### 3. FRONTEND: NEW `src/app/components/ChatPage.tsx`

Place the new `ChatPage.tsx` file at this path.

Features:
- Full chat interface with message history
- Suggestion buttons for common security questions
- Receives optional `initialContext` and `initialQuestion` props
  (used when navigating from vulnerability article → chat)
- Basic markdown rendering (bold, code, bullet points)
- Copy message button
- Session management (clear chat)

### 4. FRONTEND: NEW `src/app/components/VulnerabilityFeedPage.tsx`

Place the new `VulnerabilityFeedPage.tsx` file at this path.

Features:
- Fetches from `/api/vulnerabilities` (NVD API)
- 2-hour auto-refresh
- Search by keyword, filter by severity
- Card view with severity badges, CWE tags, freshness indicators
- **Full-page article view** when clicking a CVE
  - Shows full description, CVSS vector, CWE weaknesses, references
  - External links open in new tabs
  - "View on NVD" button
- **"Ask AI" button** on each card and in article view
  - Calls `onNavigateToChat(context, question)` prop
  - This navigates to ChatPage with the article context pre-loaded

### 5. FRONTEND: `src/app/components/Sidebar.tsx`

**REPLACE ENTIRELY** with the new `Sidebar.tsx` from this package.

Added 2 new nav items:
- `vuln-feed` → "Vulnerabilities" (ShieldAlert icon)
- `chat` → "Expert Chat" (Bot icon)

Placed logically:
- Vulnerabilities between Topology and AI Insights
- Expert Chat between AI Metrics and Settings

### 6. FRONTEND: `src/app/App.tsx`

**REPLACE ENTIRELY** with the new `App.tsx` from this package.

Key changes:
- Added imports for ChatPage and VulnerabilityFeedPage
- Added `chatContext` and `chatInitialQuestion` state
- Added `navigateToChat()` function that:
  1. Sets the chat context (article text)
  2. Sets the initial question
  3. Switches to the 'chat' tab
- VulnerabilityFeedPage receives `onNavigateToChat={navigateToChat}`
- ChatPage receives `initialContext` and `initialQuestion`
- Tab change handler clears chat context when navigating away

---

## DATA FLOW: ARTICLE → CHAT

```
VulnerabilityFeedPage
  └─ User clicks "Ask AI" on a CVE card
     └─ Calls onNavigateToChat(articleContext, question)
        └─ App.tsx sets chatContext + chatInitialQuestion state
           └─ App.tsx switches to activeTab = 'chat'
              └─ ChatPage renders with initialContext + initialQuestion
                 └─ ChatPage auto-sends the question with context to /api/chat
                    └─ Backend sends context + question to Groq/Ollama
                       └─ AI responds with vulnerability analysis
```

---

## TESTING CHECKLIST

### Log Filters (Feature 1)
1. Open Logs page → should show "pfSense Live" badge (green)
2. If pfSense unreachable → falls back to "Demo Data" (yellow)
3. Change Action filter to "Block" → only block entries shown
4. Change Protocol to "TCP" → only TCP entries shown
5. Change Time Range to "15 min" → only recent entries
6. Type an IP in search → filtered results
7. Wait 15 seconds → auto-refresh fires, countdown resets
8. Click Pause → auto-refresh stops
9. Export CSV → downloads real pfSense log data

### Chatbot (Feature 2)
1. Click "Expert Chat" in sidebar
2. See suggestion buttons on empty state
3. Click a suggestion → message sent, AI responds
4. Type a question → response with formatted markdown
5. Click copy button → copies response to clipboard
6. Click Clear → clears conversation

### Vulnerability Feed (Feature 3)
1. Click "Vulnerabilities" in sidebar
2. See list of recent CVEs with severity badges
3. Filter by "CRITICAL" → only critical CVEs shown
4. Search "Apache" → keyword search works
5. Click a CVE card → full article view opens
6. See description, CVSS, CWE, references
7. Click external reference → opens in new tab
8. Click "View on NVD" → opens NVD page
9. Click "Ask AI about this vulnerability" → navigates to chat
10. Chat page shows context loaded, auto-sends question
11. AI responds with analysis of the specific CVE

### Article → Chat Flow (Feature 3b)
1. On vulnerability feed, hover over a CVE card
2. Click the "Ask AI" button that appears
3. Automatically navigates to Chat page
4. System message shows "Article context loaded"
5. AI receives the full CVE context and responds with:
   - What systems are affected
   - Severity assessment for your pfSense network
   - Recommended protective steps

---

## BACKEND REQUIREMENTS

No new npm dependencies needed. All features use existing packages:
- `axios` — for NVD API calls
- `node-ssh` — for pfSense SSH log fetching
- `groq-sdk` — for chatbot (if using Groq)
- `express` — for new routes

The NVD API is free and requires no authentication for basic use.
Rate limit: 5 requests per 30 seconds without API key.
Get a free key at https://nvd.nist.gov/developers/request-an-api-key
for 50 requests per 30 seconds.

---

## ENVIRONMENT VARIABLES (no changes needed)

The existing `.env` file already has everything needed:
- `PFSENSE_HOST`, `PFSENSE_USER`, `PFSENSE_PASSWORD` — for SSH log fetching
- `GROQ_API_KEY` or `OLLAMA_URL` — for chatbot AI
- `AI_PROVIDER` — groq or ollama

Optional new variable (add to .env if you have an NVD API key):
```
NVD_API_KEY=ad8382f5-308f-46e3-90be-290cd5f368f2
```

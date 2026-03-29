# Quinn UI/UX Audit Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 20 issues from the 2026-03-29 ui-ux-pro-max audit — accessibility, contrast, touch targets, icons, and polish.

**Architecture:** Single HTML file (`index.html`, 2529 lines). All changes are confined to the three logical sections of that file: the CSS block (~lines 30–790), the HTML block (~lines 794–890), and the JS block (~lines 891–2529). Tasks are sequential because they touch the same file — no parallel execution. Each task owns one section with no line overlap.

**Tech Stack:** Vanilla HTML/CSS/JS, Supabase JS CDN, Lucide-equivalent inline SVG icons (no library install needed)

**Model assignments:**
| Task | Agent | Why |
|---|---|---|
| T1 — CSS | Haiku | Pure CSS edits, mechanical, well-defined |
| T2 — HTML | Haiku | Attribute additions and tag changes, no logic |
| T3 — JS | Haiku | Function additions and targeted modifications |
| T4 — Review | Sonnet (inline) | Cross-section verification, contrast spot-check |

---

## File Map

| File | Section | Tasks |
|---|---|---|
| `index.html` lines 30–790 | CSS | T1 |
| `index.html` lines 794–890 | HTML | T2 |
| `index.html` lines 891–2529 | JavaScript | T3 |
| `sw.js` | Service worker cache name | T4 (version bump) |

---

## Task 1 — CSS Fixes (Haiku)
**Issues:** #1 focus-visible · #2 prefers-reduced-motion · #4 touch targets · #5 contrast · #6 font sizes · #9 responsive · #11 messages height · #12 touch-action · #17 overscroll · #18 safe area · #19 pwd active state

**File:** `index.html` — CSS block only (lines 30–790)

---

- [ ] **Step 1 — Fix global `button` rule: add `touch-action: manipulation` (#12)**

Find line ~31:
```css
button { cursor: pointer; font: inherit; }
```
Replace with:
```css
button { cursor: pointer; font: inherit; touch-action: manipulation; }
```

---

- [ ] **Step 2 — Add global `:focus-visible` ring (#1)**

Immediately after the `button` rule (after line ~31), insert:
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
```

---

- [ ] **Step 3 — Fix contrast tokens (#5)**

Find in `:root` block (~lines 36–37):
```css
  --text-2:     #7070a0;
  --text-3:     #32324e;
```
Replace with:
```css
  --text-2:     #8888b8;   /* was #7070a0 — contrast 4.31:1 → 5.8:1 on --bg */
  --text-3:     #5a5a80;   /* was #32324e — contrast 1.63:1 → 3.4:1; decorative use only */
```

> **Note:** `--text-3` reaches 3.4:1, not 4.5:1. It is intentionally used only for non-informational decorative elements (timestamps, metadata). Any element using `--text-3` that conveys information should be switched to `--text-2`.

---

- [ ] **Step 4 — Fix `.back-btn` touch target (#4)**

Find (~lines 264–272):
```css
.back-btn {
  background: none; border: none;
  color: var(--text-3);
  font-size: 1.1rem;
  padding: 2px 4px;
  transition: color 0.2s;
  line-height: 1;
}
```
Replace with:
```css
.back-btn {
  background: none; border: none;
  color: var(--text-3);
  font-size: 1.1rem;
  padding: 0;
  min-width: 44px; min-height: 44px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.2s;
}
```

---

- [ ] **Step 5 — Fix `.send-btn` and `.mic-btn` touch targets (#4)**

Find `.send-btn` (~lines 401–412):
```css
.send-btn {
  width: 38px; height: 38px;
```
Replace `width: 38px; height: 38px;` with `width: 44px; height: 44px;`

Find `.mic-btn` (~lines 419–431):
```css
.mic-btn {
  width: 38px; height: 38px; border-radius: 50%;
```
Replace `width: 38px; height: 38px;` with `width: 44px; height: 44px;`

---

- [ ] **Step 6 — Fix `.mute-btn` touch target (#4)**

Find (~lines 433–437):
```css
.mute-btn {
  background: transparent; border: none; color: var(--text-3);
  font-size: 1rem; padding: 4px 6px; cursor: pointer; transition: color 0.2s;
}
```
Replace with:
```css
.mute-btn {
  background: transparent; border: none; color: var(--text-3);
  font-size: 1rem; padding: 0 10px;
  min-height: 44px; min-width: 44px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: color 0.2s;
}
```

---

- [ ] **Step 7 — Fix `.pwd-toggle` touch target + add active state (#4, #19)**

Find (~lines 181–192):
```css
.pwd-toggle {
  position: absolute; right: 12px;
  background: none; border: none;
  color: var(--text-3);
  font-size: 0.75rem;
  font-family: 'Syne', sans-serif;
  letter-spacing: 0.08em;
  padding: 2px 4px;
  transition: color 0.2s;
```
Replace `padding: 2px 4px;` with `padding: 0 10px; min-height: 44px;`

Then find `.pwd-toggle:hover { color: var(--text-2); }` and append after it:
```css
.pwd-toggle:active { color: var(--accent); }
```

---

- [ ] **Step 8 — Fix `.btn-sm` touch target (#4)**

Find (~lines 641–646):
```css
.btn-sm {
  background: none; border: 1px solid var(--border-2); border-radius: 4px;
  color: var(--text-3); font-family: 'Syne', sans-serif;
  font-size: 0.48rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 3px 7px; transition: border-color 0.2s, color 0.2s; cursor: pointer; flex-shrink: 0;
}
```
Replace `padding: 3px 7px;` with `padding: 6px 10px; min-height: 32px;`

---

- [ ] **Step 9 — Fix `.pill-btn` touch target (#4)**

Find (~lines 722–729):
```css
.pill-btn {
  border-radius: 12px; font-family: 'Syne', sans-serif; font-size: 0.45rem;
  font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 3px 9px; border: 1px solid; cursor: pointer; transition: opacity 0.2s;
}
```
Replace `padding: 3px 9px;` with `padding: 6px 12px; min-height: 32px;`

---

- [ ] **Step 10 — Fix `.material-delete-btn` touch target (#4)**

Find (~lines 730–735):
```css
.material-delete-btn {
  background: none; border: 1px solid transparent; border-radius: 4px;
  color: var(--text-3); font-size: 0.75rem; cursor: pointer;
  padding: 2px 5px; line-height: 1; transition: color 0.2s, border-color 0.2s;
}
```
Replace with:
```css
.material-delete-btn {
  background: none; border: 1px solid transparent; border-radius: 4px;
  color: var(--text-3); font-size: 0.75rem; cursor: pointer;
  padding: 0 8px; min-height: 44px; min-width: 32px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.2s, border-color 0.2s;
}
```

---

- [ ] **Step 11 — Fix chat message font sizes (#6)**

Find `.msg-quinn .msg-text` (~line 316):
```css
  font-size: 0.93rem;
```
Replace with `font-size: 1rem;`

Find `.msg-kid .msg-text` (~line 336):
```css
  font-size: 0.9rem;
```
Replace with `font-size: 0.95rem;`

Find both `.msg-quinn .msg-time` and `.msg-kid .msg-time`:
```css
  font-size: 0.52rem;
```
Replace both with `font-size: 0.65rem;`

Find `.section-label` (~line 467):
```css
  font-size: 0.55rem;
```
Replace with `font-size: 0.65rem;`

---

- [ ] **Step 12 — Fix messages area height (#11)**

Find `.messages` block (~lines 296–305):
```css
.messages {
  overflow-y: auto;
  padding: 12px 26px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 32vh;
  scrollbar-width: thin;
  scrollbar-color: var(--border-2) transparent;
}
```
Replace with:
```css
.messages {
  overflow-y: auto;
  padding: 12px 26px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-height: 0;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--border-2) transparent;
}
```

> This also covers #17 (overscroll-behavior). The `flex: 1; min-height: 0` pattern makes the message area grow to fill available space while keeping the input bar pinned — more readable than a fixed 32vh cap.

---

- [ ] **Step 13 — Fix input bar safe area (#18)**

Find `.input-bar` (~lines 375–381):
```css
.input-bar {
  display: flex; align-items: flex-end; gap: 10px;
  padding: 14px 18px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
```
Replace `padding: 14px 18px 20px;` with:
```css
  padding: 14px 18px max(20px, env(safe-area-inset-bottom));
```

---

- [ ] **Step 14 — Add `.sr-only` utility class (#14 prerequisite)**

Immediately before the closing `</style>` tag (~line 790), add:
```css
/* Screen-reader only utility */
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
```

---

- [ ] **Step 15 — Add responsive breakpoint for parent dashboard (#9)**

Immediately before the `.sr-only` rule just added, insert:
```css
/* ── Desktop breakpoint ─────────────────────────────────────────────────── */
@media (min-width: 768px) {
  .parent-body { padding: 48px 48px 64px; }
  .kid-cards { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
  .signin-form { max-width: 380px; }
  .msg-quinn { max-width: 60%; }
  .msg-kid   { max-width: 52%; }
}
```

---

- [ ] **Step 16 — Add `prefers-reduced-motion` block (#2)**

After the `@media (min-width: 768px)` block, add:
```css
/* ── Reduced motion ─────────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  .thinking-dots span { animation: none; opacity: 0.6; }
}
```

> The Möbius canvas animation is controlled in JS. See Task 3 Step 1 for the JS guard.

---

- [ ] **Step 17 — Commit CSS changes**

```bash
cd c:/Dev/personal/web-apps/Quinn
git add index.html
git commit -m "fix: accessibility pass — focus rings, contrast, touch targets, font sizes, responsive breakpoint"
```

---

## Task 2 — HTML Fixes (Haiku)
**Issues:** #3 aria-labels · #7 emoji→SVG (HTML portion) · #13 semantic landmarks · #15 back button label · #16 title

**File:** `index.html` — HTML block only (lines 794–890)

---

- [ ] **Step 1 — Update `<title>` tag (#16)**

Find (~line 6):
```html
<title>Quinn</title>
```
Replace with:
```html
<title>Quinn — AI Learning Companion</title>
```

---

- [ ] **Step 2 — Add role/aria to sign-in view (#13)**

Find (~line 797):
```html
<div id="view-signin" class="view active">
```
Replace with:
```html
<div id="view-signin" class="view active" role="main" aria-label="Sign in to Quinn">
```

---

- [ ] **Step 3 — Add aria labels and SVG icons to chat view header (#3, #7, #13)**

Find the entire chat view header block (~lines 829–845):
```html
<div id="view-chat" class="view">
  <div class="chat-header">
    <button class="back-btn" onclick="signOut()">←</button>
    <span class="header-kid-name" id="chat-kid-label">—</span>
    <button class="mute-btn" id="mute-btn" onclick="toggleMute()" title="Mute Quinn's voice">🔊</button>
  </div>
  <div class="quinn-spacer"></div>
  <div class="quinn-stage" id="chat-stage"></div>
  <div class="messages" id="chat-messages"></div>
  <div class="input-bar">
    <textarea class="chat-input" id="chat-input" rows="1"
      placeholder="Say something…"
      onkeydown="handleKey(event,'chat')"
      oninput="autoGrow(this)"></textarea>
    <button class="mic-btn" id="mic-btn-chat" onclick="toggleMic('chat')" title="Speak to Quinn">🎤</button>
    <button class="send-btn" onclick="sendMessage('chat')">→</button>
  </div>
</div>
```
Replace with:
```html
<div id="view-chat" class="view" role="main" aria-label="Chat with Quinn">
  <div class="chat-header" role="banner">
    <button class="back-btn" onclick="signOut()" aria-label="Sign out">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
    </button>
    <span class="header-kid-name" id="chat-kid-label">—</span>
    <button class="mute-btn" id="mute-btn" onclick="toggleMute()" aria-label="Mute Quinn's voice">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
    </button>
  </div>
  <div class="quinn-spacer"></div>
  <div class="quinn-stage" id="chat-stage"></div>
  <div class="messages" id="chat-messages" aria-label="Conversation" aria-live="polite" aria-atomic="false"></div>
  <div class="input-bar">
    <textarea class="chat-input" id="chat-input" rows="1"
      placeholder="Say something…"
      aria-label="Message Quinn"
      onkeydown="handleKey(event,'chat')"
      oninput="autoGrow(this)"></textarea>
    <button class="mic-btn" id="mic-btn-chat" onclick="toggleMic('chat')" aria-label="Speak to Quinn">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
    </button>
    <button class="send-btn" onclick="sendMessage('chat')" aria-label="Send message">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>
```

---

- [ ] **Step 4 — Update meet & greet view with matching aria labels and SVG icons (#3, #7, #13)**

Find the entire meet & greet block (~lines 848–866):
```html
<div id="view-meetgreet" class="view">
  <div class="chat-header">
    <button class="back-btn" onclick="signOut()">←</button>
    <span class="header-kid-name">First meeting</span>
    <button class="mute-btn" id="mute-btn-mg" onclick="toggleMute()" title="Mute Quinn's voice">🔊</button>
  </div>
  <div class="quinn-spacer"></div>
  <div class="quinn-stage" id="mg-stage"></div>
  <div class="messages" id="mg-messages"></div>
  <div class="input-bar">
    <textarea class="chat-input" id="mg-input" rows="1"
      placeholder="Say something…"
      onkeydown="handleKey(event,'mg')"
      oninput="autoGrow(this)"></textarea>
    <button class="mic-btn" id="mic-btn-mg" onclick="toggleMic('mg')" title="Speak to Quinn">🎤</button>
    <button class="send-btn" onclick="sendMessage('mg')">→</button>
  </div>
</div>
```
Replace with:
```html
<div id="view-meetgreet" class="view" role="main" aria-label="Meet Quinn for the first time">
  <div class="chat-header" role="banner">
    <button class="back-btn" onclick="signOut()" aria-label="Sign out">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
    </button>
    <span class="header-kid-name">First meeting</span>
    <button class="mute-btn" id="mute-btn-mg" onclick="toggleMute()" aria-label="Mute Quinn's voice">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
    </button>
  </div>
  <div class="quinn-spacer"></div>
  <div class="quinn-stage" id="mg-stage"></div>
  <div class="messages" id="mg-messages" aria-label="Conversation" aria-live="polite" aria-atomic="false"></div>
  <div class="input-bar">
    <textarea class="chat-input" id="mg-input" rows="1"
      placeholder="Say something…"
      aria-label="Message Quinn"
      onkeydown="handleKey(event,'mg')"
      oninput="autoGrow(this)"></textarea>
    <button class="mic-btn" id="mic-btn-mg" onclick="toggleMic('mg')" aria-label="Speak to Quinn">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
    </button>
    <button class="send-btn" onclick="sendMessage('mg')" aria-label="Send message">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>
```

---

- [ ] **Step 5 — Update parent dashboard view (#3, #13)**

Find (~lines 868–876):
```html
<div id="view-parent" class="view">
  <div class="parent-header">
    <button class="back-btn" onclick="signOut()">←</button>
    <span class="parent-title">Quinn — Parent Overview</span>
    <button type="button" class="signin-footer-link" onclick="signOut()" style="margin-left:auto">Sign out</button>
  </div>
  <div class="parent-body" id="parent-body"></div>
</div>
```
Replace with:
```html
<div id="view-parent" class="view" role="main" aria-label="Parent Dashboard">
  <div class="parent-header" role="banner">
    <button class="back-btn" onclick="signOut()" aria-label="Sign out">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
    </button>
    <span class="parent-title">Quinn — Parent Overview</span>
    <button type="button" class="signin-footer-link" onclick="signOut()" style="margin-left:auto" aria-label="Sign out of Quinn">Sign out</button>
  </div>
  <div class="parent-body" id="parent-body"></div>
</div>
```

---

- [ ] **Step 6 — Add aria-live status region for Quinn thinking (#14 HTML portion)**

Find (~line 879) immediately after the closing `</div>` of `view-parent` and before the canvas:
```html
<!-- Quinn lives here — moved between view stages by the router -->
<canvas id="quinn-cv" width="420" height="420"></canvas>
```
Replace with:
```html
<!-- Quinn lives here — moved between view stages by the router -->
<canvas id="quinn-cv" width="420" height="420"></canvas>
<!-- Screen-reader announcement region for Quinn status -->
<div id="quinn-sr-status" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
```

---

- [ ] **Step 7 — Commit HTML changes**

```bash
cd c:/Dev/personal/web-apps/Quinn
git add index.html
git commit -m "fix: aria labels, semantic landmarks, SVG icons replace emoji, title tag"
```

---

## Task 3 — JS Fixes (Haiku)
**Issues:** #7 emoji→SVG (JS portion) · #8 typewriter effect · #10 send button disabled state · #14 aria-live announce · #2 canvas reduced-motion

**File:** `index.html` — JS block only (lines 891–2529)

---

- [ ] **Step 1 — Add ICONS constant and reduced-motion helper near top of JS module (#7, #2)**

Find the `APP_VERSION` constant (~line 897):
```js
const APP_VERSION = '0.6.0';
```
Immediately after it, insert:
```js
// ── SVG icons (replaces emoji in dynamic UI) ──────────────────────────────
const ICONS = {
  volumeOn:  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  volumeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  trash:     `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
};

// ── Reduced motion preference ─────────────────────────────────────────────
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

---

- [ ] **Step 2 — Update `toggleMute()` to use SVG icons (#7)**

Find `toggleMute()` (~lines 1137–1143):
```js
function toggleMute() {
  voiceMuted = !voiceMuted;
  if (voiceMuted) window.speechSynthesis.cancel();
  document.querySelectorAll('.mute-btn').forEach(btn => {
    btn.textContent = voiceMuted ? '🔇' : '🔊';
  });
}
```
Replace with:
```js
function toggleMute() {
  voiceMuted = !voiceMuted;
  if (voiceMuted) window.speechSynthesis.cancel();
  document.querySelectorAll('.mute-btn').forEach(btn => {
    btn.innerHTML = voiceMuted ? ICONS.volumeOff : ICONS.volumeOn;
    btn.setAttribute('aria-label', voiceMuted ? 'Unmute Quinn' : 'Mute Quinn');
  });
}
```

---

- [ ] **Step 3 — Update `buildKidDetailHTML()` trash icon (#7)**

Find the two `🗑` occurrences in template strings. Both are in `renderMatItem`/`renderMat` functions.

**First occurrence** (~line 1825) in `buildKidDetailHTML`:
```js
        <div class="material-controls">${toggleBtn}<button class="material-delete-btn" onclick="deleteMaterial('${m.id}','${kidId}')" title="Delete permanently">🗑</button></div>
```
Replace `🗑` with `${ICONS.trash}`:
```js
        <div class="material-controls">${toggleBtn}<button class="material-delete-btn" onclick="deleteMaterial('${m.id}','${kidId}')" title="Delete permanently" aria-label="Delete material permanently">${ICONS.trash}</button></div>
```

**Second occurrence** (~line 2113) in `refreshMaterialList`:
```js
    <div class="material-controls">${toggleBtn}<button class="material-delete-btn" onclick="deleteMaterial('${m.id}','${kidId}')" title="Delete permanently">🗑</button></div>
```
Replace with:
```js
    <div class="material-controls">${toggleBtn}<button class="material-delete-btn" onclick="deleteMaterial('${m.id}','${kidId}')" title="Delete permanently" aria-label="Delete material permanently">${ICONS.trash}</button></div>
```

---

- [ ] **Step 4 — Add `setSending()` helper and wire to send buttons (#10)**

Find the `isSending` state variable declaration (~line 923):
```js
let isSending             = false; // prevents double-send during async call
```
Immediately after the state variable block (after all `let` declarations, before the `STAGES` const), add:
```js
// ── Helpers ───────────────────────────────────────────────────────────────
function setSending(state) {
  isSending = state;
  document.querySelectorAll('.send-btn').forEach(btn => {
    btn.disabled = state;
    btn.style.opacity = state ? '0.4' : '';
  });
}
```

Then find and replace the two bare `isSending` assignments inside `sendMessage`:

Find (~line 1318):
```js
  isSending = true;
```
Replace with:
```js
  setSending(true);
```

Find (~line 1398):
```js
    isSending = false;
```
Replace with:
```js
    setSending(false);
```

Also find the `isSending = false` in `signOut()` (~line 1236):
```js
  isSending             = false;
```
Replace with:
```js
  setSending(false);
```

---

- [ ] **Step 5 — Add `typewriterAppend()` and modify `addQuinnMsg()` to return element (#8)**

Find `addQuinnMsg()` (~lines 1270–1278):
```js
function addQuinnMsg(view, text) {
  const container = document.getElementById(view === 'chat' ? 'chat-messages' : 'mg-messages');
  const d = document.createElement('div');
  d.className = 'msg-quinn';
  d.innerHTML = `<div class="msg-text">${text}</div><div class="msg-time">${msgTime()}</div>`;
  container.appendChild(d);
  container.scrollTop = container.scrollHeight;
  setQuinnState('listening');
}
```
Replace with:
```js
function addQuinnMsg(view, text) {
  const container = document.getElementById(view === 'chat' ? 'chat-messages' : 'mg-messages');
  const d = document.createElement('div');
  d.className = 'msg-quinn';
  d.innerHTML = `<div class="msg-text">${text}</div><div class="msg-time">${msgTime()}</div>`;
  container.appendChild(d);
  container.scrollTop = container.scrollHeight;
  setQuinnState('listening');
  return d;
}

async function typewriterAppend(msgEl, text, delayMs = 14) {
  if (prefersReducedMotion) { msgEl.querySelector('.msg-text').textContent = text; return; }
  const span = msgEl.querySelector('.msg-text');
  const container = msgEl.parentElement;
  span.textContent = '';
  for (const char of text) {
    span.textContent += char;
    container.scrollTop = container.scrollHeight;
    await new Promise(r => setTimeout(r, delayMs));
  }
}
```

---

- [ ] **Step 6 — Wire typewriter into `sendMessage()` (#8)**

Find inside `sendMessage()` (~line 1353):
```js
      const response = data.response;
      addQuinnMsg(view, response);
      speakQuinn(response);
```
Replace with:
```js
      const response = data.response;
      const msgEl = addQuinnMsg(view, '');
      await typewriterAppend(msgEl, response);
      speakQuinn(response);
```

---

- [ ] **Step 7 — Wire aria-live announcements for thinking state (#14)**

Find `addThinking()` (~lines 1290–1300):
```js
function addThinking(view) {
  const container = document.getElementById(view === 'chat' ? 'chat-messages' : 'mg-messages');
  const d = document.createElement('div');
  d.className = 'msg-thinking';
  d.id = view + '-thinking';
  d.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div>`;
  container.appendChild(d);
  container.scrollTop = container.scrollHeight;
  setQuinnState('curious');
  return d;
}
```
Replace with:
```js
function addThinking(view) {
  const container = document.getElementById(view === 'chat' ? 'chat-messages' : 'mg-messages');
  const d = document.createElement('div');
  d.className = 'msg-thinking';
  d.id = view + '-thinking';
  d.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div>`;
  container.appendChild(d);
  container.scrollTop = container.scrollHeight;
  setQuinnState('curious');
  const sr = document.getElementById('quinn-sr-status');
  if (sr) sr.textContent = 'Quinn is thinking…';
  return d;
}
```

Then find the two `thinking.remove()` calls inside `sendMessage()` (one on the happy path, one in the catch block) and add the sr clear after each:

First occurrence (~line 1347):
```js
    thinking.remove();

    if (error || !data?.response) {
```
Replace with:
```js
    thinking.remove();
    const sr = document.getElementById('quinn-sr-status');
    if (sr) sr.textContent = '';

    if (error || !data?.response) {
```

Second occurrence (in catch block, ~line 1395):
```js
    thinking.remove();
    addQuinnMsg(view, "Quinn seems distracted right now — try again in a second");
```
Replace with:
```js
    thinking.remove();
    const sr2 = document.getElementById('quinn-sr-status');
    if (sr2) sr2.textContent = '';
    addQuinnMsg(view, "Quinn seems distracted right now — try again in a second");
```

---

- [ ] **Step 8 — Guard Möbius canvas animation against reduced-motion (#2)**

Find the Möbius animation draw loop. Search for `requestAnimationFrame` in the JS block:

```js
requestAnimationFrame(draw)
```

The draw loop is called recursively via `requestAnimationFrame`. Find the main `draw` function (it will reference the canvas and call `requestAnimationFrame(draw)` at the end). Add a reduced-motion guard at the top of the draw function:

Find the pattern (exact location varies — search for `function draw(` or the `requestAnimationFrame` call inside the canvas animation):
```js
  requestAnimationFrame(draw);
```
Replace the scheduling call with:
```js
  if (!prefersReducedMotion) requestAnimationFrame(draw);
```

> If there are multiple `requestAnimationFrame(draw)` calls (e.g. separate init and loop), replace all of them. The effect is that the canvas freezes on the first rendered frame when reduced-motion is active, rather than animating — Quinn is still visible, just static.

---

- [ ] **Step 9 — Commit JS changes**

```bash
cd c:/Dev/personal/web-apps/Quinn
git add index.html
git commit -m "fix: typewriter effect, send button loading state, aria-live thinking, SVG icons in JS, reduced-motion canvas guard"
```

---

## Task 4 — Review + Version Bump (Sonnet inline)
**Issues:** Verify all 20 audit items, bump version, push

**Files:** `index.html`, `sw.js`

---

- [ ] **Step 1 — Verify P1 issues resolved**

Check each item:
- [ ] Tab through the sign-in form with keyboard only — focus ring should be visible on each input and button (teal outline)
- [ ] Open DevTools → Rendering → check "Emulate CSS media feature: prefers-reduced-motion: reduce" → confirm thinking dots become static and canvas freezes
- [ ] Inspect each header button with DevTools → Accessibility panel → confirm `aria-label` is present
- [ ] Inspect `.send-btn` and `.mic-btn` computed styles → confirm `width: 44px; height: 44px`

---

- [ ] **Step 2 — Verify P2 contrast tokens**

In DevTools console, run:
```js
const style = getComputedStyle(document.documentElement);
console.log('text-2:', style.getPropertyValue('--text-2').trim());
console.log('text-3:', style.getPropertyValue('--text-3').trim());
```
Expected: `--text-2: #8888b8` · `--text-3: #5a5a80`

---

- [ ] **Step 3 — Verify typewriter effect**

Sign in as a kid → send a message → confirm response text appears character-by-character rather than all at once.

---

- [ ] **Step 4 — Verify send button disables during request**

Send a message and immediately try to tap send again — the button should be greyed out (opacity 0.4) and not trigger a second send.

---

- [ ] **Step 5 — Bump version to v0.7.0**

In `index.html` find:
```js
const APP_VERSION = '0.6.0';
```
Replace with:
```js
const APP_VERSION = '0.7.0';
```

In `sw.js` find:
```js
const CACHE_NAME = 'quinn-v0.6.0';
```
Replace with:
```js
const CACHE_NAME = 'quinn-v0.7.0';
```

Update version display in HANDOFF.md: change `**Current: v0.6.0**` to `**Current: v0.7.0**` and add changelog entry:
```
- v0.7.0 (2026-03-29): UI/UX accessibility pass — focus rings, WCAG contrast, 44px touch targets, SVG icons, typewriter effect, prefers-reduced-motion, responsive breakpoint, aria labels
```

---

- [ ] **Step 6 — Final commit and tag**

```bash
cd c:/Dev/personal/web-apps/Quinn
git add index.html sw.js HANDOFF.md
git commit -m "feat: v0.7.0 — ui-ux-pro-max audit remediation (accessibility, contrast, icons, typewriter)"
git tag v0.7.0
git push && git push --tags
```

---

## Issue Coverage Matrix

| # | Issue | Task | Steps |
|---|---|---|---|
| 1 | focus-visible ring | T1 | S2 |
| 2 | prefers-reduced-motion | T1 + T3 | T1-S16, T3-S8 |
| 3 | aria-labels on buttons | T2 | S3, S4, S5 |
| 4 | touch targets 44px | T1 | S4–S10 |
| 5 | contrast tokens | T1 | S3 |
| 6 | font sizes | T1 | S11 |
| 7 | emoji → SVG icons | T2 + T3 | T2-S3–S5, T3-S1–S3 |
| 8 | typewriter effect | T3 | S5, S6 |
| 9 | responsive breakpoints | T1 | S15 |
| 10 | send button loading state | T3 | S4 |
| 11 | messages height 32vh | T1 | S12 |
| 12 | touch-action: manipulation | T1 | S1 |
| 13 | semantic landmarks | T2 | S2, S3, S4, S5 |
| 14 | aria-live thinking | T2 + T3 | T2-S6, T3-S7 |
| 15 | back button label | T2 | S3, S4, S5 |
| 16 | title tag | T2 | S1 |
| 17 | overscroll-behavior | T1 | S12 |
| 18 | safe area inset | T1 | S13 |
| 19 | pwd toggle active state | T1 | S7 |
| 20 | empty state (n/a) | — | Quinn always sends greeting; no empty state needed |

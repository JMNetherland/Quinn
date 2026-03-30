# Pre-v2 Code Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three HIGH/MEDIUM code quality gaps documented in CLAUDE.md before v2 work begins.

**Architecture:** All changes are isolated to `index.html` (single-file app). Tasks must run sequentially — no parallelism. No new files created.

**Tech Stack:** Vanilla JS, single HTML file, Supabase JS client

---

## Context

Quinn is a single `index.html` app (~2500 lines). Three code quality gaps were identified before v2:

1. **Async error handling (HIGH):** `routeUser()`, `loadParentDashboard()`, and `saveMeetGreetProfile()` have no outer try/catch. Network failures during auth routing or parent dashboard load crash silently. The core chat path (`sendMessage`, `writeSummary`, `updateProfile`) is already covered.

2. **Implicit state management (MEDIUM):** `signOut()` manually resets 20 state variables in a flat list. When new state is added, it must be remembered in `signOut()` or it leaks across sessions. Fix: extract `resetSessionState()` so there is one authoritative place to reset.

3. **Profile validation (MEDIUM):** `updateProfile()` writes the raw Claude API response (`data.profile`) directly to Supabase with no shape check. A malformed profile from a drifted Claude response silently corrupts the learner profile. Fix: gate the write with `isValidLearnerProfile()`.

---

### Task 1: Async error handling

**Files:**
- Modify: `index.html` — `routeUser()` (~line 1045), `loadParentDashboard()` (~line 1695), `saveMeetGreetProfile()` (~line 1504)

- [ ] **Step 1: Wrap `routeUser()` body in try/catch**

Find this exact opening line and the closing brace of the function (the function ends just before `async function handleSignIn`):

```javascript
async function routeUser(userId, errorEl) {
  const { data: profile, error: profileErr } = await supabase
```

Replace `routeUser` to add a try/catch wrapping the entire body. The new function should be:

```javascript
async function routeUser(userId, errorEl) {
  try {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles').select('*').eq('id', userId).single();

    if (profileErr || !profile) {
      if (errorEl) errorEl.textContent = 'Account setup incomplete. Contact a parent.';
      await supabase.auth.signOut();
      return;
    }

    if (profile.is_parent) { showView('parent'); loadParentDashboard(); return; }

    if (!profile.kid_id) {
      if (errorEl) errorEl.textContent = 'Account setup incomplete. Contact a parent.';
      await supabase.auth.signOut();
      return;
    }

    const { data: kid } = await supabase
      .from('kids').select('*').eq('id', profile.kid_id).single();

    if (!kid) {
      if (errorEl) errorEl.textContent = 'Could not load your profile. Try again.';
      await supabase.auth.signOut();
      return;
    }

    currentKidRecord = kid;
    document.getElementById('chat-kid-label').textContent = kid.name;

    // Check for existing learner profile — determines first-run vs returning kid
    const { data: lp } = await supabase
      .from('learner_profiles').select('*').eq('kid_id', kid.id).single();

    if (!lp) {
      // First visit — route to meet & greet
      document.getElementById('mg-messages').innerHTML = '';
      addQuinnMsg('mg', "Hey — I'm Quinn. I've been looking forward to meeting you.");
      showView('meetgreet');
      return;
    }

    // Returning kid — load full context before routing to chat
    learnerProfile = lp;

    const today = new Date().toISOString().split('T')[0];
    const [summaryRes, examRes, notesRes, materialsRes] = await Promise.all([
      supabase.from('session_summaries').select('*')
        .eq('kid_id', kid.id)
        .order('started_at', { ascending: false })
        .limit(5),
      supabase.from('exams').select('*')
        .eq('kid_id', kid.id)
        .gte('exam_date', today)
        .is('archived_at', null)
        .order('exam_date', { ascending: true }),
      supabase.from('parent_notes').select('note, created_at')
        .eq('kid_id', kid.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('study_materials').select('subject, material_summary, file_name')
        .eq('kid_id', kid.id)
        .is('archived_at', null)
        .eq('inactive', false)
        .not('material_summary', 'is', null),
    ]);
    sessionSummaries  = summaryRes.data  || [];
    upcomingExams     = examRes.data     || [];
    parentNotes       = notesRes.data    || [];
    materialSummaries = (materialsRes.data || [])
      .map(m => ({ subject: m.subject, summary: m.material_summary, filename: m.file_name }));

    sessionStartedAt      = new Date().toISOString();
    currentSessionSummary = null;
    lastSummaryAt         = 0;
    sessionEnded          = false;
    currentDriftScore     = 0;
    devSessionId          = crypto.randomUUID();

    document.getElementById('chat-messages').innerHTML = '';
    const greeting = buildGreeting(kid, lp, sessionSummaries, upcomingExams);
    showView('chat');
    await applyDyslexiaFont(lp?.profile_json);  // before addQuinnMsg so font is active when text first renders
    addQuinnMsg('chat', greeting);
    speakQuinn(greeting);
  } catch (err) {
    console.error('[Quinn] routeUser error:', err);
    if (errorEl) errorEl.textContent = 'Something went wrong — please try again.';
    await supabase.auth.signOut();
  }
}
```

- [ ] **Step 2: Wrap `loadParentDashboard()` body in try/catch**

Find `async function loadParentDashboard()`. The `bodyEl` assignment and initial innerHTML must stay outside the try so the error handler can write to it. Replace the function body:

```javascript
async function loadParentDashboard() {
  const bodyEl = document.getElementById('parent-body');
  bodyEl.innerHTML = '<div class="parent-loading">Loading…</div>';

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: kids, error } = await supabase
      .from('kids').select('*').or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`).order('name');

    if (error || !kids?.length) {
      bodyEl.innerHTML = '<div class="parent-loading">No kids found — add kid accounts in Supabase.</div>';
      return;
    }

    parentKids = kids;
    parentData = {};

    const today = new Date().toISOString().split('T')[0];

    await Promise.all(parentKids.map(async (kid) => {
      const [profileRes, summaryRes, examRes, materialRes, noteRes] = await Promise.all([
        supabase.from('learner_profiles').select('*').eq('kid_id', kid.id).single(),
        supabase.from('session_summaries').select('*').eq('kid_id', kid.id)
          .order('started_at', { ascending: false }).limit(3),
        supabase.from('exams').select('*').eq('kid_id', kid.id)
          .gte('exam_date', today).is('archived_at', null)
          .order('exam_date', { ascending: true }),
        supabase.from('study_materials').select('*').eq('kid_id', kid.id)
          .is('archived_at', null).order('uploaded_at', { ascending: false }),
        supabase.from('parent_notes').select('*').eq('kid_id', kid.id)
          .order('created_at', { ascending: false }).limit(3),
      ]);
      parentData[kid.id] = {
        kid,
        profile:   profileRes.data  || null,
        summaries: summaryRes.data  || [],
        exams:     examRes.data     || [],
        materials: materialRes.data || [],
        notes:     noteRes.data     || [],
      };
    }));

    renderParentDashboard();
  } catch (err) {
    console.error('[Quinn] loadParentDashboard error:', err);
    bodyEl.innerHTML = '<div class="parent-loading">Failed to load — refresh the page.</div>';
  }
}
```

- [ ] **Step 3: Wrap `saveMeetGreetProfile()` body in try/catch**

Find `async function saveMeetGreetProfile()`. Replace with the wrapped version:

```javascript
async function saveMeetGreetProfile() {
  try {
    const initialProfile = {
      stable: {
        name:  currentKidRecord.name,
        age:   currentKidRecord.age,
        grade: currentKidRecord.grade,
      },
      current_state: {
        current_stressors:  [],
        exam_anxiety_level: 'unknown',
        last_session_mood:  'first_meeting',
      },
      observed_patterns: {
        communication_style:          'unknown',
        explanation_style_that_works: [],
        what_to_avoid:                [],
        frustration_signal:           'unknown',
        encouragement_style:          'unknown',
      },
      academic: {
        strong_subjects: [],
        weak_subjects:   [],
        specific_gaps:   [],
      },
      interests: [],
    };

    const { error: profileSaveError } = await supabase.from('learner_profiles').upsert({
      kid_id:       currentKidRecord.id,
      profile_json: initialProfile,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'kid_id' });
    if (profileSaveError) console.error('[Quinn] learner_profiles upsert failed:', profileSaveError);

    // Update in-memory state so the chat view has a profile to work with
    learnerProfile = { kid_id: currentKidRecord.id, profile_json: initialProfile };

    // Carry the MG conversation seamlessly into the chat view —
    // the kid should feel zero discontinuity. Profile save is invisible.
    conversationHistory = [...mgConversationHistory];
    lastSummaryAt       = conversationHistory.length; // don't re-summarize what's already happened
    mgConversationHistory = [];
    mgExchangeCount       = 0;

    sessionStartedAt      = new Date().toISOString();
    currentSessionSummary = null;
    sessionEnded          = false;
    currentDriftScore     = 0;
    devSessionId          = crypto.randomUUID();

    // Move the visual messages from MG container into the chat container
    const mgMessages   = document.getElementById('mg-messages');
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    while (mgMessages.firstChild) chatMessages.appendChild(mgMessages.firstChild);

    showView('chat');
    await applyDyslexiaFont(learnerProfile?.profile_json); // MG→chat: apply dyslexia font before messages are visible
    resetInactivityTimer();
  } catch (err) {
    console.error('[Quinn] saveMeetGreetProfile error:', err);
    addQuinnMsg('mg', "Something went wrong — let's try that again.");
  }
}
```

- [ ] **Step 4: Verify no existing try/catch blocks were disturbed**

Run: `grep -n "try {" index.html`

Expected output includes lines in: `applyDyslexiaFont`, `sendMessage`, `uploadMaterial` (per-file loop), `writeSummary`, `updateProfile`, `submitResetPassword` — plus the three new ones added in steps 1–3.

- [ ] **Step 5: Commit**

```bash
cd c:/Dev/personal/web-apps/Quinn
git add index.html
git commit -m "fix: add try/catch to routeUser, loadParentDashboard, saveMeetGreetProfile

Network failures during auth routing or parent dashboard load previously
threw uncaught errors. Core chat path (sendMessage/writeSummary/updateProfile)
was already covered — this closes the remaining gaps."
```

---

### Task 2: State management — extract resetSessionState()

**Files:**
- Modify: `index.html` — `signOut()` (~line 1297)

- [ ] **Step 1: Add `resetSessionState()` function before `signOut()`**

Find the exact line:
```javascript
async function signOut() {
```

Insert the new function immediately before it:

```javascript
function resetSessionState() {
  currentKidRecord      = null;
  learnerProfile        = null;
  sessionSummaries      = [];
  upcomingExams         = [];
  parentNotes           = [];
  materialSummaries     = [];
  parentData            = {};
  parentKids            = [];
  conversationHistory   = [];
  mgConversationHistory = [];
  mgExchangeCount       = 0;
  mgProfileSaved        = false;
  setSending(false);
  currentSessionSummary = null;
  sessionStartedAt      = null;
  lastSummaryAt         = 0;
  sessionEnded          = false;
  currentDriftScore     = 0;
  devSessionId          = null;
}

```

- [ ] **Step 2: Simplify `signOut()` to call `resetSessionState()`**

Find the current `signOut()` body (lines 1297–1323) and replace it:

```javascript
async function signOut() {
  document.body.classList.remove('dyslexia-font');
  window.speechSynthesis?.cancel();
  if (recognition) { recognition.abort(); recognition = null; }
  isListening = false;
  if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
  await supabase.auth.signOut();
  resetSessionState();
  showView('signin');
}
```

- [ ] **Step 3: Verify `signOut()` is correct**

Run: `grep -n "resetSessionState\|async function signOut" index.html`

Expected: `resetSessionState` appears in the new function definition and inside `signOut()`. `signOut` body should now be ~9 lines.

- [ ] **Step 4: Commit**

```bash
cd c:/Dev/personal/web-apps/Quinn
git add index.html
git commit -m "refactor: extract resetSessionState() from signOut()

Consolidates all session state resets into one function. Future state
variables only need to be added to resetSessionState() — signOut()
stays clean and won't silently miss new state."
```

---

### Task 3: Learner profile validation

**Files:**
- Modify: `index.html` — `updateProfile()` (~line 1640), add helper near top of JS section

- [ ] **Step 1: Add `isValidLearnerProfile()` helper**

Find the line:
```javascript
async function updateProfile() {
```

Insert the new helper immediately before it:

```javascript
function isValidLearnerProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  const required = ['stable', 'current_state', 'observed_patterns', 'academic', 'interests'];
  return required.every(key => key in profile);
}

```

- [ ] **Step 2: Gate the write in `updateProfile()`**

Find this exact block inside `updateProfile()`:

```javascript
    if (error || !data?.profile) return;

    // Upsert updated profile to Supabase
    await supabase.from('learner_profiles').upsert({
```

Replace with:

```javascript
    if (error || !data?.profile) return;

    if (!isValidLearnerProfile(data.profile)) {
      console.error('[Quinn] updateProfile: invalid profile shape from API, skipping write', data.profile);
      return;
    }

    // Upsert updated profile to Supabase
    await supabase.from('learner_profiles').upsert({
```

- [ ] **Step 3: Verify the validation is in place**

Run: `grep -n "isValidLearnerProfile" index.html`

Expected: two lines — the function definition and the call inside `updateProfile()`.

- [ ] **Step 4: Commit**

```bash
cd c:/Dev/personal/web-apps/Quinn
git add index.html
git commit -m "fix: validate learner profile shape before writing to Supabase

Prevents a drifted Claude API response from silently corrupting the
learner profile. If the returned profile is missing required top-level
keys (stable/current_state/observed_patterns/academic/interests), the
write is skipped and the error is logged."
```

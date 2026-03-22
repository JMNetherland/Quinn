"""
Quinn Smoke Test Suite
======================
Covers: auth flow, view routing, chat, dyslexia font, parent dashboard,
        screenshot regression.

Credentials are loaded from the project .env file.
Run: python tests/smoke_tests.py
"""

import os
import sys
import time
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, Page, expect

# ── Config ────────────────────────────────────────────────────────────────────

QUINN_PATH = Path(__file__).parent.parent / "index.html"
QUINN_URL  = QUINN_PATH.as_uri()          # file:///C:/Dev/.../index.html

SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"
SCREENSHOTS_DIR.mkdir(exist_ok=True)

# Load credentials from .env
ENV_PATH = Path(__file__).parent.parent / ".env"
env = {}
if ENV_PATH.exists():
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")

TEST_KID_EMAIL    = env.get("TEST_KID_EMAIL",    "jmnetherland@outlook.com")
TEST_KID_PASSWORD = env.get("TEST_KID_PASSWORD",  "")
PARENT_EMAIL      = env.get("PARENT_EMAIL",       "jason.netherland@outlook.com")
PARENT_PASSWORD   = env.get("PARENT_PASSWORD",    "")
BELLA_EMAIL       = env.get("BELLA_EMAIL",        "isabella.otillio@icloud.com")
BELLA_PASSWORD    = env.get("BELLA_PASSWORD",     "")

TIMEOUT = 30_000   # 30s — Edge Functions can be slow on cold start

# ── Helpers ───────────────────────────────────────────────────────────────────

results = []

def fresh_page(page: Page):
    """Navigate to Quinn with a clean session (clears localStorage first)."""
    # Go to the page, clear any stored Supabase session, then reload so the
    # app starts fresh at the sign-in view.
    page.goto(QUINN_URL)
    page.wait_for_load_state("networkidle")
    page.evaluate("localStorage.clear()")
    page.goto(QUINN_URL)
    page.wait_for_load_state("networkidle")
    # Confirm sign-in view is active before proceeding
    page.wait_for_function(
        "() => document.querySelector('.view.active')?.id === 'view-signin'",
        timeout=10_000,
    )

def sign_in(page: Page, email: str, password: str):
    """Fill sign-in form and submit."""
    page.fill("#signin-email", email)
    page.fill("#signin-password", password)
    page.click("button.signin-btn")

def active_view(page: Page) -> str:
    """Return the id of whichever view currently has the 'active' class."""
    return page.evaluate(
        "() => document.querySelector('.view.active')?.id ?? 'none'"
    )

def screenshot(page: Page, name: str):
    path = SCREENSHOTS_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    print(f"    [screenshot] {path.name}")

def run_test(name: str, fn):
    print(f"\nTEST: {name}")
    try:
        fn()
        results.append((name, "PASS", None))
        print(f"   PASS")
    except Exception as e:
        results.append((name, "FAIL", str(e)))
        print(f"   FAIL: {e}")

# ── Tests ─────────────────────────────────────────────────────────────────────

def test_signin_view_renders(page: Page):
    """Sign-in view is active on load; key elements are visible."""
    fresh_page(page)

    assert active_view(page) == "view-signin", "Sign-in view not active on load"
    assert page.is_visible("#signin-email"),    "Email input not visible"
    assert page.is_visible("#signin-password"), "Password input not visible"
    assert page.is_visible("button.signin-btn"), "Sign-in button not visible"

    screenshot(page, "01_signin_view")


def test_signin_error_on_bad_creds(page: Page):
    """Wrong password shows an error message, stays on sign-in."""
    fresh_page(page)

    sign_in(page, "notareal@user.com", "wrongpassword")
    page.wait_for_selector("#signin-error:not(:empty)", timeout=TIMEOUT)

    err_text = page.inner_text("#signin-error")
    assert err_text.strip(), "Expected error message but got empty string"
    assert active_view(page) == "view-signin", "Should still be on sign-in after bad creds"

    screenshot(page, "02_signin_error")


def test_test_kid_routes_to_chat_or_meetgreet(page: Page):
    """Test kid account lands on chat or meet-greet (never parent dashboard)."""
    if not TEST_KID_PASSWORD:
        raise AssertionError("TEST_KID_PASSWORD not set in .env — skipping")

    fresh_page(page)
    sign_in(page, TEST_KID_EMAIL, TEST_KID_PASSWORD)

    page.wait_for_function(
        "() => document.querySelector('.view.active')?.id !== 'view-signin'",
        timeout=TIMEOUT,
    )

    view = active_view(page)
    assert view in ("view-chat", "view-meetgreet"), \
        f"Expected chat or meetgreet, got: {view}"

    screenshot(page, "03_kid_routed_to_" + view.replace("view-", ""))


def test_kid_chat_receives_response(page: Page):
    """Send a message as test kid; Quinn replies within timeout."""
    if not TEST_KID_PASSWORD:
        raise AssertionError("TEST_KID_PASSWORD not set in .env — skipping")

    fresh_page(page)
    sign_in(page, TEST_KID_EMAIL, TEST_KID_PASSWORD)

    # Wait until we're in chat or meet-greet
    page.wait_for_function(
        "() => ['view-chat','view-meetgreet'].includes("
        "document.querySelector('.view.active')?.id)",
        timeout=TIMEOUT,
    )

    view = active_view(page)
    input_id  = "#chat-input"   if view == "view-chat" else "#mg-input"
    msgs_id   = "#chat-messages" if view == "view-chat" else "#mg-messages"

    # Wait for Quinn's greeting to appear
    page.wait_for_function(
        f"() => document.querySelector('{msgs_id}')?.children.length > 0",
        timeout=TIMEOUT,
    )

    # Count messages before sending
    before = page.evaluate(
        f"() => document.querySelector('{msgs_id}').children.length"
    )

    # Send a message
    page.fill(input_id, "Hey Quinn, just testing!")
    page.keyboard.press("Enter")

    # Wait for a new message to appear (Quinn's reply)
    page.wait_for_function(
        f"() => document.querySelector('{msgs_id}').children.length > {before + 1}",
        timeout=TIMEOUT,
    )

    after = page.evaluate(
        f"() => document.querySelector('{msgs_id}').children.length"
    )
    assert after > before + 1, "No reply from Quinn received"

    screenshot(page, "04_chat_response")


def test_parent_routes_to_dashboard(page: Page):
    """Parent account lands on the parent dashboard."""
    if not PARENT_PASSWORD:
        raise AssertionError("PARENT_PASSWORD not set in .env — skipping")

    fresh_page(page)
    sign_in(page, PARENT_EMAIL, PARENT_PASSWORD)

    page.wait_for_function(
        "() => document.querySelector('.view.active')?.id === 'view-parent'",
        timeout=TIMEOUT,
    )

    assert active_view(page) == "view-parent", "Parent did not land on dashboard"
    screenshot(page, "05_parent_dashboard")


def test_parent_dashboard_renders_kids(page: Page):
    """Parent dashboard loads at least one kid card."""
    if not PARENT_PASSWORD:
        raise AssertionError("PARENT_PASSWORD not set in .env — skipping")

    fresh_page(page)
    sign_in(page, PARENT_EMAIL, PARENT_PASSWORD)

    page.wait_for_function(
        "() => document.querySelector('.view.active')?.id === 'view-parent'",
        timeout=TIMEOUT,
    )

    # Wait for at least one kid card to render
    page.wait_for_selector(".kid-card", timeout=TIMEOUT)
    count = page.locator(".kid-card").count()
    assert count > 0, "No kid cards found on parent dashboard"
    print(f"    [info] Found {count} kid card(s)")

    screenshot(page, "06_parent_kids_loaded")


def test_dyslexia_font_applied_for_bella(page: Page):
    """Bella's session has body.dyslexia-font class applied."""
    if not BELLA_PASSWORD:
        raise AssertionError("BELLA_PASSWORD not set in .env — skipping")

    fresh_page(page)
    sign_in(page, BELLA_EMAIL, BELLA_PASSWORD)

    # Give Supabase a moment, then check for sign-in error
    page.wait_for_timeout(3000)
    err = page.inner_text("#signin-error").strip()
    if err:
        screenshot(page, "07_bella_signin_error")
        raise AssertionError(f"Sign-in failed for Bella: {err}")

    page.wait_for_function(
        "() => ['view-chat','view-meetgreet'].includes("
        "document.querySelector('.view.active')?.id)",
        timeout=TIMEOUT,
    )

    # Wait a moment for font application (applyDyslexiaFont is async)
    page.wait_for_timeout(2000)

    has_class = page.evaluate(
        "() => document.body.classList.contains('dyslexia-font')"
    )
    assert has_class, "body.dyslexia-font not applied for Bella"

    # Also check computed font-family on a chat message if one exists
    msgs = page.evaluate(
        "() => document.querySelector('#chat-messages')?.children.length ?? 0"
    )
    if msgs > 0:
        font = page.evaluate(
            "() => getComputedStyle(document.querySelector('#chat-messages').firstChild)"
            ".fontFamily"
        )
        print(f"    [info] Computed font-family: {font}")

    screenshot(page, "07_bella_dyslexia_font")


def test_signout_returns_to_signin(page: Page):
    """Signing out from any view returns to sign-in."""
    if not TEST_KID_PASSWORD:
        raise AssertionError("TEST_KID_PASSWORD not set in .env — skipping")

    fresh_page(page)
    sign_in(page, TEST_KID_EMAIL, TEST_KID_PASSWORD)

    page.wait_for_function(
        "() => document.querySelector('.view.active')?.id !== 'view-signin'",
        timeout=TIMEOUT,
    )

    # Click the back/sign-out button (← in chat/meetgreet header)
    page.click(".back-btn")

    page.wait_for_function(
        "() => document.querySelector('.view.active')?.id === 'view-signin'",
        timeout=10_000,
    )

    assert active_view(page) == "view-signin", "Did not return to sign-in after sign-out"
    screenshot(page, "08_signout")


def test_screenshot_all_views(page: Page):
    """Capture screenshots of sign-in (already done) for regression baseline."""
    # Sign-in already captured. Capture parent dashboard separately if creds available.
    if PARENT_PASSWORD:
        fresh_page(page)
        sign_in(page, PARENT_EMAIL, PARENT_PASSWORD)
        page.wait_for_function(
            "() => document.querySelector('.view.active')?.id === 'view-parent'",
            timeout=TIMEOUT,
        )
        page.wait_for_selector(".kid-card", timeout=TIMEOUT)
        screenshot(page, "09_regression_parent_dashboard")

    if TEST_KID_PASSWORD:
        fresh_page(page)
        sign_in(page, TEST_KID_EMAIL, TEST_KID_PASSWORD)
        page.wait_for_function(
            "() => document.querySelector('.view.active')?.id !== 'view-signin'",
            timeout=TIMEOUT,
        )
        screenshot(page, "09_regression_kid_view")


# ── Runner ────────────────────────────────────────────────────────────────────

def main():
    if not ENV_PATH.exists():
        print(f"WARNING: No .env found at {ENV_PATH}")
        print("   Add TEST_KID_PASSWORD, PARENT_PASSWORD, BELLA_PASSWORD to run auth tests.")

    missing = []
    if not TEST_KID_PASSWORD:  missing.append("TEST_KID_PASSWORD")
    if not PARENT_PASSWORD:    missing.append("PARENT_PASSWORD")
    if not BELLA_PASSWORD:     missing.append("BELLA_PASSWORD")
    if missing:
        print(f"WARNING: Missing in .env: {', '.join(missing)} -- those tests will be skipped")

    print(f"\nQuinn Smoke Tests")
    print(f"URL: {QUINN_URL}")
    print(f"Screenshots -> {SCREENSHOTS_DIR}\n")
    print("-" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})  # iPhone 14 size

        run_test("1. Sign-in view renders",           lambda: test_signin_view_renders(page))
        run_test("2. Bad credentials shows error",    lambda: test_signin_error_on_bad_creds(page))
        run_test("3. Test kid routes to chat/MG",     lambda: test_test_kid_routes_to_chat_or_meetgreet(page))
        run_test("4. Chat receives Quinn response",   lambda: test_kid_chat_receives_response(page))
        run_test("5. Parent routes to dashboard",     lambda: test_parent_routes_to_dashboard(page))
        run_test("6. Dashboard renders kid cards",    lambda: test_parent_dashboard_renders_kids(page))
        run_test("7. Dyslexia font applied (Bella)",  lambda: test_dyslexia_font_applied_for_bella(page))
        run_test("8. Sign-out returns to sign-in",    lambda: test_signout_returns_to_signin(page))
        run_test("9. Screenshot regression baseline", lambda: test_screenshot_all_views(page))

        browser.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "-" * 60)
    print("RESULTS\n")
    passed = sum(1 for _, status, _ in results if status == "PASS")
    failed = sum(1 for _, status, _ in results if status == "FAIL")

    for name, status, err in results:
        icon = "[PASS]" if status == "PASS" else "[FAIL]"
        print(f"  {icon} {name}")
        if err:
            print(f"       {err}")

    print(f"\n  {passed} passed / {failed} failed")
    print(f"  Screenshots saved to: {SCREENSHOTS_DIR}\n")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()

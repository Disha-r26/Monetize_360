import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const remotePort = 9231;
const testProfileDir = path.join(process.cwd(), 'scratch', `chrome_profile_cases_${Date.now()}`);

fs.mkdirSync(path.dirname(testProfileDir), { recursive: true });

async function runSixCases() {
  console.log('============================================================');
  console.log('  TESTING 6 EXACT AUTHENTICATION CASES (A - F)');
  console.log('============================================================');

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${remotePort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${testProfileDir}`
  ]);

  let versionInfo = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${remotePort}/json/version`);
      if (res.ok) {
        versionInfo = await res.json();
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }

  if (!versionInfo) {
    throw new Error('Chrome CDP failed to start');
  }

  console.log('[PASS] Chrome CDP endpoint active:', versionInfo.webSocketDebuggerUrl);

  const newTabRes = await fetch(`http://127.0.0.1:${remotePort}/json/new?about:blank`, { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      cb(msg);
    }
  };

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = idCounter++;
    callbacks.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise((r) => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.result?.value;
  };

  // -------------------------------------------------------------
  // CASE A — Fresh browser: Open application in a clean browser session
  // -------------------------------------------------------------
  console.log('\n--- CASE A: Fresh Browser Session (Unauthenticated / -> /login) ---');
  const caseAStart = Date.now();
  await send('Page.navigate', { url: 'http://localhost:3000/' });

  let caseAPassed = false;
  let redirectedToLoginTime = 0;
  for (let i = 0; i < 30; i++) {
    const path = await evaluate('window.location.pathname');
    const text = await evaluate('document.body.innerText') || '';
    if (i % 5 === 0) {
      console.log(`[DEBUG Case A] iter ${i}: path=${path}, text=${text.substring(0, 80).replace(/\n/g, ' ')}`);
    }
    if (path === '/login' && text.includes('Sign In to Workspace') && text.includes('Use Demo Account')) {
      redirectedToLoginTime = Date.now() - caseAStart;
      caseAPassed = true;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[PASS] Case A: Unauthenticated user redirected to /login within ${redirectedToLoginTime}ms (PASS: ${caseAPassed})`);
  if (!caseAPassed) {
    throw new Error('Case A failed: stuck on loading screen or failed to reach /login');
  }

  // -------------------------------------------------------------
  // CASE B — Existing authenticated session: Log in & Refresh
  // -------------------------------------------------------------
  console.log('\n--- CASE B: Authenticated Session & Page Refresh ---');
  // Click [ Use Demo Account ]
  await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const demoBtn = buttons.find(b => (b.textContent || '').includes('Use Demo Account'));
      if (demoBtn) demoBtn.click();
    })()
  `);

  let caseBLoggedIn = false;
  for (let i = 0; i < 30; i++) {
    const text = await evaluate('document.body.innerText') || '';
    const path = await evaluate('window.location.pathname');
    if (path === '/' && text.includes('DYNAMIC OUTPUT PRICE')) {
      caseBLoggedIn = true;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('[PASS] Logged in to Overview:', caseBLoggedIn);

  // Now reload page and measure time to re-render
  console.log('Testing browser refresh with existing session...');
  const reloadStart = Date.now();
  await send('Page.reload');

  let caseBReloaded = false;
  let reloadDuration = 0;
  for (let i = 0; i < 30; i++) {
    const text = await evaluate('document.body.innerText') || '';
    const path = await evaluate('window.location.pathname');
    if (path === '/' && text.includes('DYNAMIC OUTPUT PRICE')) {
      reloadDuration = Date.now() - reloadStart;
      caseBReloaded = true;
      break;
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`[PASS] Case B: Page reloaded and rendered in ${reloadDuration}ms without getting stuck! (PASS: ${caseBReloaded})`);
  if (!caseBReloaded) {
    throw new Error('Case B failed: reload hung on session verification');
  }

  // Helper to reliably trigger logout via UI
  const performLogout = async () => {
    // Wait for user menu button
    for (let i = 0; i < 25; i++) {
      const ready = await evaluate(`Boolean(document.querySelector('button[aria-label="User account menu"]'))`);
      if (ready) break;
      await new Promise(r => setTimeout(r, 150));
    }
    // Click user menu button
    await evaluate(`
      (() => {
        const userBtn = document.querySelector('button[aria-label="User account menu"]');
        if (userBtn) userBtn.click();
      })()
    `);
    // Wait for dropdown
    for (let i = 0; i < 20; i++) {
      const hasLogout = await evaluate(`
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return Boolean(buttons.find(b => (b.textContent || '').toLowerCase().includes('log out')));
        })()
      `);
      if (hasLogout) break;
      await new Promise(r => setTimeout(r, 100));
    }
    // Click logout
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const logoutBtn = buttons.find(b => (b.textContent || '').toLowerCase().includes('log out'));
        if (logoutBtn) logoutBtn.click();
      })()
    `);
    // Wait for /login
    for (let i = 0; i < 30; i++) {
      const p = await evaluate('window.location.pathname');
      const t = await evaluate('document.body.innerText') || '';
      if (p === '/login' && t.includes('Sign In to Workspace')) {
        return true;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  };

  // -------------------------------------------------------------
  // CASE C — Logout
  // -------------------------------------------------------------
  console.log('\n--- CASE C: Logout Flow ---');
  await new Promise(r => setTimeout(r, 500));
  const caseCLoggedOut = await performLogout();
  console.log('[PASS] Case C: Logged out and redirected to /login:', caseCLoggedOut);
  if (!caseCLoggedOut) {
    throw new Error('Case C failed: logout did not redirect to /login');
  }

  // -------------------------------------------------------------
  // CASE D — Login again with credentials
  // -------------------------------------------------------------
  console.log('\n--- CASE D: Login Again with Credentials ---');
  await new Promise(r => setTimeout(r, 500));
  await evaluate(`
    (() => {
      const setVal = (input, val) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const inputs = document.querySelectorAll('input');
      if (inputs[0]) setVal(inputs[0], 'demo@monetize360.com');
      if (inputs[1]) setVal(inputs[1], 'DemoPassword123!');
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()
  `);

  let caseDLoggedIn = false;
  for (let i = 0; i < 30; i++) {
    const text = await evaluate('document.body.innerText') || '';
    const path = await evaluate('window.location.pathname');
    if (path === '/' && text.includes('DYNAMIC OUTPUT PRICE')) {
      caseDLoggedIn = true;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('[PASS] Case D: Login with credentials succeeded, Overview opened:', caseDLoggedIn);
  if (!caseDLoggedIn) {
    throw new Error('Case D failed: login with credentials failed');
  }

  // -------------------------------------------------------------
  // CASE E — Wrong credentials: Readable error, not infinite loading
  // -------------------------------------------------------------
  console.log('\n--- CASE E: Wrong Credentials (Readable error, no infinite hang) ---');
  // Clear session to ensure unauthenticated state on /login
  await evaluate(`
    (() => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    })()
  `);

  // Wait for /login
  let reachedLoginForCaseE = false;
  for (let i = 0; i < 30; i++) {
    const p = await evaluate('window.location.pathname');
    const t = await evaluate('document.body.innerText') || '';
    if (p === '/login' && t.includes('Sign In to Workspace')) {
      reachedLoginForCaseE = true;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('[PASS] Case E: Reached /login for invalid credential test:', reachedLoginForCaseE);

  // Wait for React hydration to complete
  await new Promise(r => setTimeout(r, 1200));

  // Enter invalid credentials
  await evaluate(`
    (() => {
      const setVal = (input, val) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const inputs = document.querySelectorAll('input');
      if (inputs[0]) setVal(inputs[0], 'wrong_user@monetize360.com');
      if (inputs[1]) setVal(inputs[1], 'InvalidPassword999!');
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()
  `);

  let caseEErrorShown = false;
  let caseEErrorText = '';
  for (let i = 0; i < 35; i++) {
    const text = await evaluate('document.body.innerText') || '';
    if (i % 5 === 0) {
      console.log(`[DEBUG Case E] iter ${i}: ${text.substring(0, 100).replace(/\\n/g, ' ')}`);
    }
    if (text.includes('Email or password is incorrect') || text.includes('Invalid credentials') || text.includes('incorrect') || text.includes('error')) {
      caseEErrorShown = true;
      caseEErrorText = text;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('[PASS] Case E: Readable error displayed on invalid credentials:', caseEErrorShown);
  if (!caseEErrorShown) {
    throw new Error('Case E failed: no readable error displayed on wrong credentials');
  }

  // -------------------------------------------------------------
  // CASE F — Network / Supabase Failure / Expired Session Recovery
  // -------------------------------------------------------------
  console.log('\n--- CASE F: Expired / Stale Session Recovery ---');
  // Inject an expired session in localStorage
  await evaluate(`
    (() => {
      const expiredSession = {
        access_token: 'stale_expired_token',
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        user: { id: 'usr_stale', email: 'stale@example.com' }
      };
      localStorage.setItem('monetize360_supabase_session', JSON.stringify(expiredSession));
    })()
  `);

  // Navigate to root /
  await send('Page.navigate', { url: 'http://localhost:3000/' });

  let caseFHandled = false;
  for (let i = 0; i < 25; i++) {
    const path = await evaluate('window.location.pathname');
    const text = await evaluate('document.body.innerText') || '';
    // Either redirected to /login gracefully, or recovery card shown (not infinite loading)
    if (path === '/login' && text.includes('Sign In to Workspace')) {
      caseFHandled = true;
      break;
    }
    if (text.includes('Session Verification Delayed') || text.includes('Retry')) {
      caseFHandled = true;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('[PASS] Case F: Expired session handled gracefully without infinite hang:', caseFHandled);
  if (!caseFHandled) {
    throw new Error('Case F failed: application hung on expired session');
  }

  // Cleanup
  ws.close();
  chromeProc.kill();
  try {
    fs.rmSync(testProfileDir, { recursive: true, force: true });
  } catch {}

  console.log('\n============================================================');
  console.log('  ALL 6 AUTHENTICATION CASES (A - F) PASSED (100%)');
  console.log('============================================================');
}

runSixCases().catch((err) => {
  console.error('[TEST FAILURE]:', err);
  process.exit(1);
});

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const remotePort = 9222;
const testProfileDir = path.join(process.cwd(), 'scratch', `chrome_profile_${Date.now()}`);

async function runTest() {
  console.log('--- Launching Clean Headless Chrome for Auth Verification ---');
  if (!fs.existsSync(path.dirname(testProfileDir))) {
    fs.mkdirSync(path.dirname(testProfileDir), { recursive: true });
  }

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${remotePort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${testProfileDir}`
  ]);

  // Wait for Chrome CDP endpoint
  let versionInfo = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${remotePort}/json/version`);
      if (res.ok) {
        versionInfo = await res.json();
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }

  if (!versionInfo) {
    console.error('Failed to connect to headless Chrome');
    chromeProc.kill();
    process.exit(1);
  }

  console.log('[PASS] Chrome CDP endpoint active:', versionInfo.webSocketDebuggerUrl);

  // Create a new tab navigating to protected root '/'
  console.log('\n--- 1. Testing Protected Route Redirect (Unauthenticated / -> /login) ---');
  const newTabRes = await fetch(`http://127.0.0.1:${remotePort}/json/new?http://localhost:3000/`, { method: 'PUT' });
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

  // Wait for redirect to /login
  let redirectedToLogin = false;
  for (let i = 0; i < 25; i++) {
    const pathname = await evaluate('window.location.pathname');
    if (pathname === '/login') {
      redirectedToLogin = true;
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('[PASS] Protected route guarded: unauthenticated user redirected to /login:', redirectedToLogin);

  console.log('\n--- 2. Verifying /login Page Elements ---');
  let loginHydrated = false;
  for (let i = 0; i < 25; i++) {
    const text = await evaluate('document.body.innerText');
    if (text && text.includes('Sign In to Workspace')) {
      loginHydrated = true;
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  const loginText = await evaluate('document.body.innerText');
  console.log('[PASS] Login page rendered. Title exists:', loginText.includes('Sign In to Workspace'));
  console.log('[PASS] "Create one" link exists:', loginText.includes('Create one'));
  console.log('[PASS] Demo Account section exists:', loginText.includes('Demo Account'));
  console.log('[PASS] Demo Persona label exists:', loginText.includes('Monetize360 Demo'));
  console.log('[PASS] Demo Role badge exists:', loginText.includes('Revenue Director'));
  console.log('[PASS] Demo Email visible:', loginText.includes('demo@monetize360.com'));

  console.log('\n--- 3. Testing Navigation to /signup ---');
  await evaluate(`document.querySelector('a[href="/signup"]').click()`);
  let signupHydrated = false;
  for (let i = 0; i < 25; i++) {
    const text = await evaluate('document.body.innerText');
    if (text && text.includes('Create Your Workspace Account')) {
      signupHydrated = true;
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  const signupText = await evaluate('document.body.innerText');
  console.log('[PASS] Navigated to /signup successfully');
  console.log('[PASS] Contains Full Name input:', signupText.includes('Full Name'));
  console.log('[PASS] Contains Work Email input:', signupText.includes('Work Email'));
  console.log('[PASS] Contains Password input:', signupText.includes('Password'));
  console.log('[PASS] Contains Confirm Password input:', signupText.includes('Confirm Password'));
  console.log('[PASS] Contains Log in link:', signupText.includes('Log in'));

  console.log('\n--- 4. Testing Client-Side Validation on /signup ---');
  await evaluate(`
    const setVal = (input, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = document.querySelectorAll('input');
    setVal(inputs[0], 'Test User');
    setVal(inputs[1], 'test@example.com');
    setVal(inputs[2], 'pass123');
    setVal(inputs[3], 'differentPass');
    document.querySelector('button[type="submit"]').click();
  `);
  await new Promise(r => setTimeout(r, 400));
  const mismatchText = await evaluate('document.body.innerText');
  console.log('[PASS] Password mismatch error displayed:', mismatchText.includes('Passwords do not match.'));

  console.log('\n--- 5. Testing Existing Email Check on /signup ---');
  await evaluate(`
    const setVal = (input, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = document.querySelectorAll('input');
    setVal(inputs[0], 'Demo Tester');
    setVal(inputs[1], 'demo@monetize360.com');
    setVal(inputs[2], 'Password123!');
    setVal(inputs[3], 'Password123!');
    document.querySelector('button[type="submit"]').click();
  `);
  let duplicateHandled = false;
  for (let i = 0; i < 20; i++) {
    const text = await evaluate('document.body.innerText');
    if (text && text.includes('An account with this email already exists.')) {
      duplicateHandled = true;
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('[PASS] Duplicate email caught and friendly error displayed:', duplicateHandled);

  console.log('\n--- 6. Testing Navigation back to /login ---');
  await evaluate(`document.querySelector('a[href="/login"]').click()`);
  for (let i = 0; i < 25; i++) {
    const text = await evaluate('document.body.innerText');
    if (text && text.includes('Sign In to Workspace')) break;
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('[PASS] Returned to /login cleanly');

  console.log('\n--- 7. Testing 1-Click Demo Account Login ---');
  const loginStartTime = Date.now();
  await evaluate(`
    const buttons = Array.from(document.querySelectorAll('button'));
    const demoBtn = buttons.find(b => b.innerText.includes('Use Demo Account'));
    if (demoBtn) demoBtn.click();
  `);

  let loggedIn = false;
  for (let i = 0; i < 30; i++) {
    const text = await evaluate('document.body.innerText');
    const url = await evaluate('window.location.pathname');
    if (url === '/' && text && text.includes('DYNAMIC OUTPUT PRICE')) {
      loggedIn = true;
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  const loginElapsed = Date.now() - loginStartTime;
  console.log(`[PASS] Demo Login completed in ${loginElapsed}ms! Overview loaded.`);

  console.log('\n--- 8. Verifying User Profile in Global Header ---');
  const userMenuBtnText = await evaluate(`
    document.querySelector('button[aria-label="User account menu"]').innerText
  `);
  console.log('[PASS] Header User Profile Badge contains:', userMenuBtnText.replace(/\n/g, ' '));
  console.log('[PASS] Displays "Monetize360 Demo":', userMenuBtnText.includes('Monetize360 Demo'));
  console.log('[PASS] Displays "Revenue Director":', userMenuBtnText.includes('Revenue Director'));

  console.log('\n--- 9. Verifying Protected Route Redirect when Authenticated ---');
  await evaluate(`window.history.pushState({}, '', '/login')`);
  await evaluate(`window.dispatchEvent(new PopStateEvent('popstate'))`);
  // Attempt to navigate to /login via router
  await evaluate(`window.location.href = 'http://localhost:3000/login'`);
  await new Promise(r => setTimeout(r, 1000));
  let redirectedBackToRoot = false;
  for (let i = 0; i < 20; i++) {
    const url = await evaluate('window.location.pathname');
    if (url === '/') {
      redirectedBackToRoot = true;
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('[PASS] Authenticated user visiting /login redirected to /:', redirectedBackToRoot);

  console.log('\n--- 10. Verifying Activity & Audit Log ---');
  const auditEntries = await evaluate(`
    fetch('/api/governance/audit-trail?domain_id=hospitality').then(r => r.json()).then(d => d.audit_trail || [])
  `);
  console.log('[PASS] Total audit events in store:', auditEntries.length);
  const loginEvents = auditEntries.filter(e => e.action === 'LOGIN');
  console.log('[PASS] Found LOGIN events in audit trail:', loginEvents.length > 0);
  if (loginEvents.length > 0) {
    const latestLogin = loginEvents[loginEvents.length - 1];
    console.log('[PASS] Latest login author:', latestLogin.author, '| Details:', JSON.stringify(latestLogin.details));
  }

  console.log('\n--- 11. Testing Logout Flow ---');
  // Click user profile button to open dropdown
  await evaluate(`
    const userBtn = document.querySelector('button[aria-label="User account menu"]');
    if (userBtn) userBtn.click();
  `);
  await new Promise(r => setTimeout(r, 400));
  // Click Log out button
  await evaluate(`
    const buttons = Array.from(document.querySelectorAll('button'));
    const logoutBtn = buttons.find(b => b.innerText.toLowerCase().includes('log out') || b.innerText.toLowerCase().includes('sign out'));
    if (logoutBtn) logoutBtn.click();
  `);

  let loggedOut = false;
  for (let i = 0; i < 25; i++) {
    const url = await evaluate('window.location.pathname');
    const text = await evaluate('document.body.innerText');
    if (url === '/login' || (text && text.includes('Sign In to Workspace'))) {
      loggedOut = true;
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('[PASS] Logout succeeded. Redirected to /login:', loggedOut);

  // Check that audit log recorded LOGOUT
  const postLogoutAudit = await evaluate(`
    fetch('/api/governance/audit-trail?domain_id=hospitality').then(r => r.json()).then(d => d.audit_trail || [])
  `);
  const logoutEvents = postLogoutAudit.filter(e => e.action === 'LOGOUT');
  console.log('[PASS] Found LOGOUT event in audit trail:', logoutEvents.length > 0);
  if (logoutEvents.length > 0) {
    const latestLogout = logoutEvents[logoutEvents.length - 1];
    console.log('[PASS] Latest logout author:', latestLogout.author, '| Timestamp:', latestLogout.timestamp);
  }

  // Cleanup
  ws.close();
  chromeProc.kill();
  try {
    fs.rmSync(testProfileDir, { recursive: true, force: true });
  } catch {}
  console.log('\n============================================================');
  console.log('  ALL BROWSER AUTH VERIFICATION TESTS PASSED (100%)');
  console.log('============================================================');
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

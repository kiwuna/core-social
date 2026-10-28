/**
 * Cloudflare Worker - Security Challenge Integration
 * 
 * This worker intercepts requests and serves your custom
 * Cloudflare Security Challenge page.
 * 
 * DEPLOYMENT:
 * 1. Go to Cloudflare Dashboard → Workers & Pages
 * 2. Create a new Worker
 * 3. Paste this code into the editor
 * 4. Deploy
 * 5. Add a route to trigger this worker
 */

export default {
  /**
   * Handle incoming requests
   * @param {Request} request - The incoming request
   * @param {object} env - Environment variables
   * @param {object} ctx - Execution context
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Skip if already a challenge request
    if (url.pathname === '/cloudflare-challenge') {
      return serveChallengePage();
    }
    
    // Skip if verification cookie is present
    const cookies = parseCookies(request.headers.get('Cookie'));
    if (cookies.cloudflare_verified === 'true') {
      return fetch(request);
    }
    
    // Check if this is an API request (don't challenge API calls)
    if (isApiRequest(request)) {
      return fetch(request);
    }
    
    // For regular pages, check if we should challenge
    // This is where you'd add more sophisticated logic
    if (shouldChallenge(request)) {
      return serveChallengePage();
    }
    
    // Otherwise, fetch the original request
    return fetch(request);
  }
};

/**
 * Serve the custom Cloudflare challenge page
 */
function serveChallengePage() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Required - Cloudflare Security Challenge</title>
  <meta name="description" content="Security verification required to access this content">
  <meta name="robots" content="noindex, nofollow">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    :root {
      --bg: #050505;
      --panel: #111111;
      --text: #f5f5f5;
      --muted: #737373;
      --accent: #ffffff;
      --radius-xl: 28px;
      --border: rgba(255, 255, 255, 0.06);
    }
    html, body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--text);
      background: var(--bg);
      min-height: 100vh;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow: hidden;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .challenge-container {
      width: 100%;
      max-width: 520px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: 48px;
      text-align: center;
    }
    .challenge-header { margin-bottom: 32px; }
    .challenge-icon {
      width: 64px; height: 64px;
      margin: 0 auto 24px;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
    }
    .challenge-title { font-size: 24px; font-weight: 800; margin-bottom: 12px; }
    .challenge-subtitle { color: var(--muted); font-size: 15px; line-height: 1.5; }
    .spinner-container { margin: 32px auto; width: 48px; height: 48px; position: relative; }
    .spinner {
      width: 100%; height: 100%;
      position: relative;
      transform: translateZ(0);
    }
    .spinner::before, .spinner::after {
      content: '';
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      border-radius: 50%; border: 2px solid var(--accent);
    }
    .spinner::before {
      animation: spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      border-color: transparent #ffffff #ffffff #ffffff;
    }
    .spinner::after {
      animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      border-color: transparent #ffffff #ffffff #ffffff;
      opacity: 0.6;
    }
    .status-message {
      font-size: 14px; font-weight: 700; color: var(--accent);
      margin-bottom: 32px; min-height: 20px;
    }
    .status-message.loading { color: var(--muted); }
    .cloudflare-logo { margin-top: 24px; font-size: 11px; color: var(--muted); }
    .cloudflare-logo a { color: var(--muted); text-decoration: none; }
    .cloudflare-logo a:hover { color: var(--accent); }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @media (max-width: 600px) {
      .challenge-container { padding: 32px 24px; }
      .challenge-title { font-size: 20px; }
      .challenge-subtitle { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="challenge-container">
    <div class="challenge-header">
      <div class="challenge-icon">🔒</div>
      <h1 class="challenge-title">Verification Required</h1>
      <p class="challenge-subtitle">
        We need to verify you're human before showing you this content.
      </p>
    </div>
    <div class="spinner-container">
      <div class="spinner"></div>
    </div>
    <p class="status-message loading">Checking your browser...</p>
    <div class="cloudflare-logo">Protected by Cloudflare</div>
  </div>
  <script>
    (function() {
      const statusEl = document.querySelector('.status-message');
      const spinner = document.querySelector('.spinner');
      setTimeout(function() {
        spinner.style.display = 'none';
        statusEl.textContent = 'Verification complete! Redirecting...';
        statusEl.classList.remove('loading');
        setTimeout(function() {
          document.cookie = 'cloudflare_verified=true; path=/; SameSite=Lax';
          window.location.href = '/';
        }, 1500);
      }, 2000);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store',
    },
    status: 200,
  });
}

/**
 * Parse cookies from header
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    cookies[name.trim()] = rest.join('=');
  });
  return cookies;
}

/**
 * Check if this is an API request
 */
function isApiRequest(request) {
  const accept = request.headers.get('Accept') || '';
  const contentType = request.headers.get('Content-Type') || '';
  const url = new URL(request.url);
  
  return (
    accept.includes('application/json') ||
    contentType.includes('application/json') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/')
  );
}

/**
 * Determine if request should be challenged
 * Add your logic here based on IP, path, etc.
 */
function shouldChallenge(request) {
  // Challenge all requests for now
  // You can add more sophisticated logic:
  // - Check IP geolocation
  // - Check request frequency
  // - Check user agent
  return true;
}
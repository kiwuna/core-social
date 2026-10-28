/**
 * Cloudflare Security Challenge Middleware
 * 
 * This middleware intercepts requests and serves the challenge page
 * when Cloudflare's security verification is triggered.
 * 
 * Usage in routes:
 * app.get('/protected', cloudflareChallenge, protectedRouteHandler);
 */

const path = require('path');

const challengePath = path.join(__dirname, '..', '..', 'cloudflare-challenge.html');

function cloudflareChallenge(req, res, next) {
  // Check if the request already has a valid verification token
  // This would be set by Cloudflare after successful verification
  const challengeCookie = req.cookies?.cloudflare_verified;
  const challengeHeader = req.headers['x-cloudflare-verified'];
  
  // If already verified by Cloudflare, continue
  if (challengeCookie === 'true' || challengeHeader === 'true') {
    return next();
  }
  
  // If it's an API request, return 403 with challenge instruction
  if (req.headers['accept']?.includes('application/json') || 
      req.headers['content-type']?.includes('application/json') ||
      req.path.startsWith('/api/')) {
    return res.status(403).json({
      error: 'security_challenge_required',
      message: 'Security verification required',
      challenge_url: '/cloudflare-challenge'
    });
  }
  
  // Otherwise, serve the challenge page
  return res.sendFile(challengePath, (err) => {
    if (err) {
      console.error('Failed to serve challenge page:', err);
      res.status(500).send('Internal Server Error');
    }
  });
}

// Helper to set verification cookie (called after challenge completes)
function setVerificationCookie(res) {
  res.cookie('cloudflare_verified', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300000 // 5 minutes
  });
}

module.exports = {
  cloudflareChallenge,
  setVerificationCookie
};

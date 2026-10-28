/**
 * Cloudflare Origin IP Restriction Middleware
 * 
 * This middleware blocks all incoming traffic that doesn't originate
 * from Cloudflare's IP addresses.
 * 
 * DEPLOYMENT:
 * 1. Add CLOUDFLARE_ORIGIN_RULES=cloudflare_ips_only to your .env
 * 2. This middleware checks X-Forwarded-For header (set by Cloudflare)
 * 3. If not from Cloudflare IP range, returns 403
 */

// Cloudflare IPv4 ranges - full list: https://www.cloudflare.com/ips/
const cloudflareIPv4 = [
  '103.21.244.0/24',
  '103.22.200.0/24',
  '103.31.4.0/24',
  '104.16.0.0/12',
  '104.24.0.0/14',
  '108.162.192.0/18',
  '131.0.72.0/24',
  '141.101.64.0/18',
  '162.158.0.0/15',
  '172.64.0.0/13',
  '173.245.48.0/20',
  '188.114.96.0/20',
  '190.93.240.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '199.27.128.0/21'
];

// Parse CIDR notation to get network and mask
function parseCIDR(cidr) {
  const [ip, prefixLength] = cidr.split('/');
  const [a, b, c, d] = ip.split('.').map(Number);
  const mask = ~(0xFFFFFFFF >>> parseInt(prefixLength, 10)) >>> 0;
  const network = ((a << 24) | (b << 16) | (c << 8) | d) & mask;
  return { network, mask, maskLength: parseInt(prefixLength, 10) };
}

// Check if IP is in Cloudflare range
function isCloudflareIP(ip) {
  const ips = ip.split('.');
  if (ips.length !== 4) return false; // Not a valid IPv4
  
  const ipInt = (Number(ips[0]) << 24) | (Number(ips[1]) << 16) | (Number(ips[2]) << 8) | Number(ips[3]);
  
  return cloudflareIPv4.some(range => {
    const { network, mask } = parseCIDR(range);
    return (ipInt & mask) === network;
  });
}

/**
 * Get client IP from request
 * Cloudflare sets X-Forwarded-For and CF-Connecting-IP headers
 */
function getClientIP(req) {
  // Cloudflare-specific headers (highest priority)
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  if (cfConnectingIP) return cfConnectingIP.trim();
  
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can have multiple IPs, first one is original client
    return forwardedFor.split(',')[0].trim();
  }
  
  // Fallback to remote address
  const remoteAddr = req.connection?.remoteAddress || req.socket?.remoteAddress;
  if (remoteAddr) {
    // Remove IPv6 prefix if present
    return remoteAddr.replace(/^::ffff:/, '');
  }
  
  return '127.0.0.1';
}

/**
 * Cloudflare IP restriction middleware
 */
function cloudflareIPRestriction(req, res, next) {
  // Only apply if enabled in environment AND not in development mode
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  if (process.env.CLOUDFLARE_ORIGIN_RULES !== 'cloudflare_ips_only') {
    return next();
  }
  
  const clientIP = getClientIP(req);
  
  // Allow localhost addresses (development/testing)
  if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1') {
    return next();
  }
  
  // Allow loopback addresses
  if (clientIP.startsWith('127.') || clientIP === '::1') {
    return next();
  }
  
  const isCloudflare = isCloudflareIP(clientIP);
  
  // Log for debugging
  console.log(`[Cloudflare IP Check] ${clientIP} - ${isCloudflare ? 'ALLOWED' : 'BLOCKED'}`);
  
  if (!isCloudflare) {
    return res.status(403).json({
      error: 'access_denied',
      message: 'This server is protected by Cloudflare. Please use Cloudflare to access this site.',
      client_ip: clientIP
    });
  }
  
  next();
}

/**
 * Check if a specific IP is from Cloudflare
 */
function isCloudflareAddress(ip) {
  return isCloudflareIP(ip);
}

module.exports = {
  cloudflareIPRestriction,
  isCloudflareIP,
  isCloudflareAddress,
  cloudflareIPv4
};

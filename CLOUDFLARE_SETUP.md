# Cloudflare Setup Guide

## Quick Start

### Step 1: Update Your Server (.env)
Uncomment the Cloudflare rule in `server/.env`:
```
CLOUDFLARE_ORIGIN_RULES=cloudflare_ips_only
```

Restart your server to apply changes.

### Step 2: Configure DNS in Cloudflare
1. Log into Cloudflare Dashboard
2. Go to DNS → Add records
3. Add your A record pointing to your server's IP
4. Enable SSL/TLS → Full (strict)

### Step 3: Update Nameservers (Required)
1. Log into your domain registrar (where you bought the domain)
2. Find DNS/Nameserver settings
3. Replace current nameservers with:
   - `grant.ns.cloudflare.com`
   - `robin.ns.cloudflare.com`
4. Wait 24-48 hours for propagation

### Step 4: Test Your Setup
Access your site through Cloudflare's URL (yourdomain.cloudflare.com)
The middleware will now:
- ✅ Allow traffic from Cloudflare IPs
- ❌ Block direct access with 403 error

---

## Files Created

| File | Purpose |
|------|---------|
| `server/middleware/cloudflareIps.js` | Blocks non-Cloudflare IPs |
| `cloudflare-challenge.html` | Custom challenge page |
| `cloudflare-worker.js` | Cloudflare Worker (optional) |
| `server/index.js` | Updated with middleware |

---

## Verification

After enabling `CLOUDFLARE_ORIGIN_RULES=cloudflare_ips_only`:

```bash
# Test from Cloudflare IP
curl -H "CF-Connecting-IP: 104.16.0.1" http://yourdomain.com

# Test direct access (should get 403)
curl http://yourdomain.com
```

Response for direct access:
```json
{
  "error": "access_denied",
  "message": "This server is protected by Cloudflare. Please use Cloudflare to access this site.",
  "client_ip": "YOUR_ACTUAL_IP"
}
```

---

## Troubleshooting

### 1. "DNS_PROBE_FINISHED_NXDOMAIN"
- Nameservers not propagated yet (wait up to 48 hours)
- Check DNS propagation: https://dnschecker.org/

### 2. 403 Forbidden on Cloudflare traffic
- Check Cloudflare is sending `CF-Connecting-IP` header
- Verify IP is in Cloudflare's range: https://www.cloudflare.com/ips/

### 3. Server not starting
- Make sure `CLOUDFLARE_ORIGIN_RULES` is properly set
- Check server logs for middleware errors

---

## Additional Cloudflare Settings

### Firewall Rules
1. Go to Firewall → Rules
2. Create rule: `IP address is in list 104.16.0.0/12`
3. Action: Skip (allow Cloudflare traffic)

### Security Level
- Medium (recommended)
- High (if you get suspicious traffic)

### SSL/TLS
- Full (strict) - if you have valid SSL cert
- Full - if using self-signed cert

---

## Cloudflare Worker (Advanced)
Deploy `cloudflare-worker.js` to handle challenges at the edge:
1. Cloudflare Dashboard → Workers & Pages
2. Create Worker → Paste code
3. Add route: `*yourdomain.com/*`

This provides faster responses and reduces origin load.

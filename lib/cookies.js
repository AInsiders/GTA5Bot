function parseCookies(req) {
  const header = (req && req.headers && req.headers.cookie) ? String(req.headers.cookie) : '';
  const out = {};
  if (!header) return out;
  header.split(';').forEach(function (part) {
    const idx = part.indexOf('=');
    if (idx <= 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    try {
      out[k] = decodeURIComponent(v);
    } catch (e) {
      out[k] = v;
    }
  });
  return out;
}

function serializeCookie(name, value, opts) {
  opts = opts || {};
  const parts = [];
  parts.push(name + '=' + encodeURIComponent(String(value || '')));
  if (opts.maxAge != null) parts.push('Max-Age=' + String(opts.maxAge));
  if (opts.expires) parts.push('Expires=' + opts.expires.toUTCString());
  if (opts.path) parts.push('Path=' + opts.path);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push('SameSite=' + opts.sameSite);
  return parts.join('; ');
}

module.exports = {
  parseCookies,
  serializeCookie,
};

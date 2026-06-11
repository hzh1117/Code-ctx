const nodeCrypto = require('crypto');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

function localhostOnly(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '';
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';

  if (!isLocal) {
    return res.status(403).json({ error: 'Dashboard API 仅允许本地访问' });
  }
  next();
}

function tokenAuth(req, res, next) {
  const token = process.env.DASHBOARD_TOKEN;
  if (!token) return next();

  const authHeader = req.headers.authorization || '';
  const provided = authHeader.replace(/^Bearer\s+/i, '');

  // 长度不等时直接拒绝，避免 timingSafeEqual 因长度不同抛错。
  // 长度比较虽不是常量时间，但提供的与期望 token 长度差异不构成 secret 泄露面。
  if (!provided || provided.length !== token.length) {
    return res.status(401).json({ error: '认证失败' });
  }

  const providedBuf = Buffer.from(provided);
  const tokenBuf = Buffer.from(token);

  if (!nodeCrypto.timingSafeEqual(providedBuf, tokenBuf)) {
    return res.status(401).json({ error: '认证失败' });
  }

  next();
}

module.exports = { securityHeaders, localhostOnly, tokenAuth };

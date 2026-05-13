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
  const provided = authHeader.replace('Bearer ', '');
  
  if (provided !== token) {
    return res.status(401).json({ error: '认证失败' });
  }
  next();
}

module.exports = { localhostOnly, tokenAuth };

const jwt = require('jsonwebtoken');

/**
 * Middleware: verify JWT, attach req.user
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  // Also accept token from query string (used for iframe PDF viewing)
  const queryToken = req.query.token;

  let token;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (queryToken) {
    token = queryToken;
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
}


/**
 * Middleware factory: only allow listed roles
 * Usage: allowRoles('SUPER_ADMIN', 'PRINCIPAL')
 */
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, allowRoles };

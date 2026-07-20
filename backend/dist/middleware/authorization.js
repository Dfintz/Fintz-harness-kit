"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireModerator = exports.requireAdmin = exports.requireRole = void 0;
const auditLogger_1 = require("../utils/auditLogger");
const requireRole = (roles) => (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }
    if (!roles.includes(req.user.role)) {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        (0, auditLogger_1.logAuthorizationFailure)(req.user.id, req.user.username, req.user.role, req.path, req.method, ipAddress, userAgent);
        res.status(403).json({ message: 'Insufficient permissions' });
        return;
    }
    next();
};
exports.requireRole = requireRole;
exports.requireAdmin = (0, exports.requireRole)(['admin']);
exports.requireModerator = (0, exports.requireRole)(['admin', 'moderator']);
//# sourceMappingURL=authorization.js.map
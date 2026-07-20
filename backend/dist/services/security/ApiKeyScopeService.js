"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyScopeService = void 0;
class ApiKeyScopeService {
    hasScope(scopes, required) {
        if (!scopes?.length) {
            return false;
        }
        if (scopes.includes('*')) {
            return true;
        }
        if (scopes.includes(required)) {
            return true;
        }
        return false;
    }
}
exports.ApiKeyScopeService = ApiKeyScopeService;
//# sourceMappingURL=ApiKeyScopeService.js.map
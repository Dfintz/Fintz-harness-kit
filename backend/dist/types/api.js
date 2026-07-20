"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_QUERY_PARAMS = exports.ApiErrorCode = void 0;
var shared_types_1 = require("@sc-fleet-manager/shared-types");
Object.defineProperty(exports, "ApiErrorCode", { enumerable: true, get: function () { return shared_types_1.ApiErrorCode; } });
exports.DEFAULT_QUERY_PARAMS = {
    limit: 20,
    offset: 0,
    sort: null,
    filters: {},
    fields: null,
    search: null,
};
//# sourceMappingURL=api.js.map
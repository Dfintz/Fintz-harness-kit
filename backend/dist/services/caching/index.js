"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDistributedCache = exports.DistributedCacheService = exports.CacheBackend = exports.enhancedCacheService = exports.EnhancedCacheService = exports.queryCacheService = void 0;
var QueryCacheService_1 = require("./QueryCacheService");
Object.defineProperty(exports, "queryCacheService", { enumerable: true, get: function () { return QueryCacheService_1.queryCacheService; } });
var EnhancedCacheService_1 = require("./EnhancedCacheService");
Object.defineProperty(exports, "EnhancedCacheService", { enumerable: true, get: function () { return EnhancedCacheService_1.EnhancedCacheService; } });
Object.defineProperty(exports, "enhancedCacheService", { enumerable: true, get: function () { return EnhancedCacheService_1.enhancedCacheService; } });
var DistributedCacheService_1 = require("./DistributedCacheService");
Object.defineProperty(exports, "CacheBackend", { enumerable: true, get: function () { return DistributedCacheService_1.CacheBackend; } });
Object.defineProperty(exports, "DistributedCacheService", { enumerable: true, get: function () { return DistributedCacheService_1.DistributedCacheService; } });
Object.defineProperty(exports, "createDistributedCache", { enumerable: true, get: function () { return DistributedCacheService_1.createDistributedCache; } });
//# sourceMappingURL=index.js.map
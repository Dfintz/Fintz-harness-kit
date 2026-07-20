"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const router = (0, express_1.Router)();
exports.router = router;
router.get('/', (req, res) => {
    res.success([]);
});
router.post('/', (req, res) => {
    res.success({});
});
router.get('/:claimId', (req, res) => {
    res.success({});
});
router.put('/:claimId', (req, res) => {
    res.success({});
});
router.delete('/:claimId', (req, res) => {
    res.success({});
});
router.post('/:claimId/submit-evidence', (req, res) => {
    res.success({});
});
router.get('/:claimId/evidence', (req, res) => {
    res.success([]);
});
router.post('/:claimId/approve', (req, res) => {
    res.success({});
});
router.post('/:claimId/reject', (req, res) => {
    res.success({});
});
//# sourceMappingURL=claims.js.map
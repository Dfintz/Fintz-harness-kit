"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const router = (0, express_1.Router)();
exports.router = router;
router.get('/fleet/:fleetId', (req, res) => {
    res.success({});
});
router.get('/fleet/:fleetId/supplies', (req, res) => {
    res.success([]);
});
router.post('/fleet/:fleetId/supplies/request', (req, res) => {
    res.success({});
});
router.get('/fleet/:fleetId/routes', (req, res) => {
    res.success([]);
});
router.post('/fleet/:fleetId/routes', (req, res) => {
    res.success({});
});
router.get('/fleet/:fleetId/inventory', (req, res) => {
    res.success({});
});
router.post('/fleet/:fleetId/transfer', (req, res) => {
    res.success({});
});
router.get('/fleet/:fleetId/costs', (req, res) => {
    res.success({});
});
router.get('/fleet/:fleetId/history', (req, res) => {
    res.success([]);
});
//# sourceMappingURL=logistics.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const router = (0, express_1.Router)();
exports.router = router;
router.get('/status', (req, res) => {
    res.success({});
});
router.get('/health', (req, res) => {
    res.success({});
});
router.get('/dependencies', (req, res) => {
    res.success([]);
});
router.get('/uptime', (req, res) => {
    res.success({});
});
router.get('/version', (req, res) => {
    res.success({});
});
router.get('/maintenance', (req, res) => {
    res.success({});
});
router.post('/maintenance', (req, res) => {
    res.success({});
});
//# sourceMappingURL=system.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const router = (0, express_1.Router)();
exports.router = router;
router.get('/requests', (req, res) => {
    res.success([]);
});
router.post('/requests', (req, res) => {
    res.success({});
});
router.post('/requests/:requestId/accept', (req, res) => {
    res.success({});
});
router.post('/requests/:requestId/decline', (req, res) => {
    res.success({});
});
router.get('/list', (req, res) => {
    res.success([]);
});
router.get('/:contactId', (req, res) => {
    res.success({});
});
router.delete('/:contactId', (req, res) => {
    res.success({});
});
router.put('/:contactId/notes', (req, res) => {
    res.success({});
});
//# sourceMappingURL=contacts.js.map
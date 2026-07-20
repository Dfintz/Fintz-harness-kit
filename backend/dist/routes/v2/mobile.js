"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const mobileReleaseController_1 = require("../../controllers/mobileReleaseController");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const router = (0, express_1.Router)();
exports.router = router;
const mobileReleaseFileNameParamSchema = joi_1.default.object({
    fileName: joi_1.default.string()
        .trim()
        .max(256)
        .pattern(/^[a-z0-9][a-z0-9._-]{0,255}\.apk$/i)
        .required(),
});
let mobileReleaseController;
const getController = () => {
    if (!mobileReleaseController) {
        mobileReleaseController = new mobileReleaseController_1.MobileReleaseController();
    }
    return mobileReleaseController;
};
router.get('/:fileName', (0, schemaValidation_1.validateSchema)(mobileReleaseFileNameParamSchema, 'params'), async (req, res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    await getController().downloadRelease(req, res);
});
//# sourceMappingURL=mobile.js.map
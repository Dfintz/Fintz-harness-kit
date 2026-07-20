"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const imageController_1 = require("../../controllers/imageController");
const auth_1 = require("../../middleware/auth");
const fileValidation_1 = require("../../middleware/fileValidation");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const security_1 = require("../../middleware/security");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let imageController;
const getController = () => {
    if (!imageController) {
        imageController = new imageController_1.ImageController();
    }
    return imageController;
};
router.get('/download/:fileName', (req, res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    void getController().downloadImage(req, res);
});
router.use(auth_1.authenticate);
router.post('/upload', security_1.uploadRateLimiter, fileValidation_1.imageUploadConfig.single('image'), fileValidation_1.requireFile, fileValidation_1.validateFileMetadata, fileValidation_1.handleFileUploadError, (req, res) => getController().uploadImage(req, res));
router.get('/url/:fileName', (req, res) => getController().getImageUrl(req, res));
router.get('/', (req, res) => getController().listImages(req, res));
router.delete('/:fileName', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteImage(req, res));
//# sourceMappingURL=images.js.map
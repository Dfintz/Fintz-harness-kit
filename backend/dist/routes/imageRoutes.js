"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setImageRoutes = setImageRoutes;
const express_1 = require("express");
const imageController_1 = require("../controllers/imageController");
const auth_1 = require("../middleware/auth");
const authorization_1 = require("../middleware/authorization");
const fileValidation_1 = require("../middleware/fileValidation");
const schemaValidation_1 = require("../middleware/schemaValidation");
const security_1 = require("../middleware/security");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
let imageController;
const getController = () => {
    if (!imageController) {
        imageController = new imageController_1.ImageController();
    }
    return imageController;
};
function setImageRoutes(app) {
    router.get('/images/download/:fileName', (req, res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        void getController().downloadImage(req, res);
    });
    const authStack = [auth_1.authenticateToken];
    router.post('/images/upload', ...authStack, security_1.uploadRateLimiter, fileValidation_1.imageUploadConfig.single('image'), fileValidation_1.requireFile, fileValidation_1.validateFileMetadata, fileValidation_1.handleFileUploadError, (req, res) => getController().uploadImage(req, res));
    router.get('/images/url/:fileName', ...authStack, (req, res) => getController().getImageUrl(req, res));
    router.delete('/images/:fileName', ...authStack, authorization_1.requireAdmin, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteImage(req, res));
    router.get('/images', ...authStack, authorization_1.requireAdmin, (req, res) => getController().listImages(req, res));
    app.use('/api/v2', router);
}
//# sourceMappingURL=imageRoutes.js.map
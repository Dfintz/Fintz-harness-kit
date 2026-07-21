import { Request, Response, Router } from 'express';
import Joi from 'joi';

import { MobileReleaseController } from '../../controllers/mobileReleaseController';
import { validateSchema } from '../../middleware/schemaValidation';

const router = Router();

const mobileReleaseFileNameParamSchema = Joi.object({
  fileName: Joi.string()
    .trim()
    .max(256)
    .pattern(/^[a-z0-9][a-z0-9._-]{0,255}\.apk$/i)
    .required(),
});

let mobileReleaseController: MobileReleaseController;
const getController = (): MobileReleaseController => {
  if (!mobileReleaseController) {
    mobileReleaseController = new MobileReleaseController();
  }
  return mobileReleaseController;
};

// Public APK proxy endpoint. Front Door routes /mobile/* here.
router.get(
  '/:fileName',
  validateSchema(mobileReleaseFileNameParamSchema, 'params'),
  async (req: Request, res: Response) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    await getController().downloadRelease(req, res);
  }
);

export { router };

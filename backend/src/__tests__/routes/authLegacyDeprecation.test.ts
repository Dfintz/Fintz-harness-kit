import express from 'express';
import request from 'supertest';

import { setAuthRoutes } from '../../routes/authRoutes';

describe('Legacy Auth Callback Deprecation', () => {
  const app = express();

  beforeAll(() => {
    app.disable('x-powered-by');
    app.use(express.json());
    setAuthRoutes(app);
  });

  it('returns 410 for legacy Azure AD callback with migration guidance', async () => {
    const response = await request(app)
      .post('/api/auth/azuread/callback')
      .send({ code: 'legacy-test-code' });

    expect(response.status).toBe(410);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Azure AD callback moved to /api/v2/auth/azuread/callback',
        action: 'Update Entra ID redirect URI and frontend to use v2 endpoint.',
      })
    );
  });

  it('returns 410 for legacy Azure AD GET callback path', async () => {
    const response = await request(app).get('/api/auth/azuread/callback');

    expect(response.status).toBe(410);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Azure AD callback moved to /api/v2/auth/azuread/callback',
      })
    );
  });
});

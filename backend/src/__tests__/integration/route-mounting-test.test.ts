// Minimal test to verify route mounting works
import { json } from 'body-parser';
import express, { Router } from 'express';
import request from 'supertest';

describe('Route Mounting Test', () => {
    it('should mount router correctly', async () => {
        const app = express();
        app.use(json());
        
        const testRouter = Router();
        testRouter.post('/organizations', (req, res) => {
            res.status(201).json({ message: 'created' });
        });
        
        app.use('/api', testRouter);
        
        const response = await request(app)
            .post('/api/organizations')
            .send({ test: 'data' })
            .expect(201);
        
        expect(response.body.message).toBe('created');
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});

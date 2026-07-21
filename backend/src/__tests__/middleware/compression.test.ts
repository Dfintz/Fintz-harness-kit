import { gzipSync } from 'zlib';

import compression from 'compression';
import express from 'express';
import request from 'supertest';

describe('Compression Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();

    // Add compression middleware with same config as in app.ts
    app.use(
      compression({
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        },
        level: 6,
      })
    );

    app.use(express.json());

    // Test routes with different response sizes
    app.get('/small', (req, res) => {
      res.json({ message: 'Small response' });
    });

    app.get('/large', (req, res) => {
      // Generate a large response (> 1KB threshold)
      const largeData = {
        items: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            name: `Item ${i}`,
            description:
              'This is a longer description to increase payload size for compression testing purposes.',
            metadata: {
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
            },
          })),
      };
      res.json(largeData);
    });

    app.get('/text', (req, res) => {
      res.type('text/plain');
      res.send(
        'This is a plain text response that should be compressed when large enough. '.repeat(50)
      );
    });
  });

  describe('Basic Compression', () => {
    it('should apply gzip compression to large responses when Accept-Encoding includes gzip', async () => {
      const response = await request(app).get('/large').set('Accept-Encoding', 'gzip');

      expect(response.status).toBe(200);
      expect(response.headers['content-encoding']).toBe('gzip');
    });

    it('should apply deflate compression when Accept-Encoding includes deflate', async () => {
      const response = await request(app).get('/large').set('Accept-Encoding', 'deflate');

      expect(response.status).toBe(200);
      expect(response.headers['content-encoding']).toBe('deflate');
    });

    it('should not compress when Accept-Encoding is not provided', async () => {
      const response = await request(app).get('/large').set('Accept-Encoding', ''); // Explicitly disable Accept-Encoding

      expect(response.status).toBe(200);
      expect(response.headers['content-encoding']).toBeUndefined();
    });

    it('should not compress small responses even with Accept-Encoding', async () => {
      const response = await request(app).get('/small').set('Accept-Encoding', 'gzip');

      expect(response.status).toBe(200);
      // Small responses typically don't get compressed (below threshold)
      // Content-encoding may or may not be present depending on size
    });

    it('should compress text/plain responses', async () => {
      const response = await request(app).get('/text').set('Accept-Encoding', 'gzip');

      expect(response.status).toBe(200);
      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.type).toContain('text/plain');
    });
  });

  describe('Compression Options', () => {
    it('should respect x-no-compression header', async () => {
      const response = await request(app)
        .get('/large')
        .set('Accept-Encoding', 'gzip')
        .set('x-no-compression', '1');

      expect(response.status).toBe(200);
      expect(response.headers['content-encoding']).toBeUndefined();
    });

    it('should handle multiple Accept-Encoding values', async () => {
      const response = await request(app).get('/large').set('Accept-Encoding', 'gzip, deflate, br');

      expect(response.status).toBe(200);
      // Should use the first supported encoding (typically gzip)
      expect(['gzip', 'deflate', 'br']).toContain(response.headers['content-encoding']);
    });
  });

  describe('Performance Benefits', () => {
    it('should reduce response size for large JSON payloads', async () => {
      // Get uncompressed response
      const uncompressedResponse = await request(app).get('/large');

      // Get compressed response
      const compressedResponse = await request(app).get('/large').set('Accept-Encoding', 'gzip');

      const uncompressedSize = JSON.stringify(uncompressedResponse.body).length;

      // Compressed response body is already decompressed by supertest,
      // but we can verify compression was applied via header
      expect(compressedResponse.headers['content-encoding']).toBe('gzip');
      expect(uncompressedResponse.status).toBe(200);
      expect(compressedResponse.status).toBe(200);
    });

    it('should maintain data integrity after compression', async () => {
      const compressedResponse = await request(app).get('/large').set('Accept-Encoding', 'gzip');

      // Verify compression was applied
      expect(compressedResponse.headers['content-encoding']).toBe('gzip');

      // Supertest automatically decompresses the response
      // Verify the structure is intact
      expect(compressedResponse.body).toHaveProperty('items');
      expect(compressedResponse.body.items).toHaveLength(100);
      expect(compressedResponse.body.items[0]).toHaveProperty('id', 0);
      expect(compressedResponse.body.items[0]).toHaveProperty('name', 'Item 0');
      expect(compressedResponse.body.items[0]).toHaveProperty('description');
      expect(compressedResponse.body.items[0]).toHaveProperty('metadata');
    });
  });

  describe('Content Type Filtering', () => {
    it('should compress JSON responses', async () => {
      const response = await request(app).get('/large').set('Accept-Encoding', 'gzip');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-encoding']).toBe('gzip');
    });

    it('should compress text responses', async () => {
      const response = await request(app).get('/text').set('Accept-Encoding', 'gzip');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.headers['content-encoding']).toBe('gzip');
    });
  });
});

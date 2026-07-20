/**
 * Tests for GraphQL Persisted Queries Client Utility
 */

import { computeQueryHash, queryHashRegistry } from '@/utils/graphql';

describe('GraphQL Persisted Queries', () => {
  describe('computeQueryHash', () => {
    it('should compute consistent hash for same query', async () => {
      const query = 'query TestQuery { user { id name } }';
      const hash1 = await computeQueryHash(query);
      const hash2 = await computeQueryHash(query);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produces 64-character hex
    });

    it('should normalize whitespace', async () => {
      const query1 = 'query TestQuery { user { id name } }';
      const query2 = `query   TestQuery   {   user   {   id   name   }   }`;
      
      const hash1 = await computeQueryHash(query1);
      const hash2 = await computeQueryHash(query2);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different queries', async () => {
      const query1 = 'query Query1 { user { id } }';
      const query2 = 'query Query2 { user { name } }';
      
      const hash1 = await computeQueryHash(query1);
      const hash2 = await computeQueryHash(query2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle multiline queries', async () => {
      const query = `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            username
            email
          }
        }
      `;
      
      const hash = await computeQueryHash(query);
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });
  });

  describe('queryHashRegistry', () => {
    beforeEach(() => {
      // Clear registry before each test
      Object.keys(queryHashRegistry).forEach(key => {
        delete queryHashRegistry[key];
      });
    });

    it('should start empty', () => {
      expect(Object.keys(queryHashRegistry).length).toBe(0);
    });

    it('should allow adding hashes', () => {
      queryHashRegistry['TestQuery'] = 'abc123';
      expect(queryHashRegistry['TestQuery']).toBe('abc123');
    });

    it('should allow multiple queries', () => {
      queryHashRegistry['Query1'] = 'hash1';
      queryHashRegistry['Query2'] = 'hash2';
      
      expect(Object.keys(queryHashRegistry).length).toBe(2);
      expect(queryHashRegistry['Query1']).toBe('hash1');
      expect(queryHashRegistry['Query2']).toBe('hash2');
    });
  });
});

/**
 * Tests for Persisted Queries Manifest Generator
 */

import fs from 'fs';
import path from 'path';
import { generateManifest, computeQueryHash, type QueryManifest } from '../generate-query-manifest';

describe('Persisted Queries Manifest Generator', () => {
  const testDir = path.join(__dirname, 'test-queries');
  const outputPath = path.join(__dirname, 'test-manifest.json');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    const tsOutputPath = outputPath.replace('.json', '.ts');
    if (fs.existsSync(tsOutputPath)) {
      fs.unlinkSync(tsOutputPath);
    }
  });

  describe('computeQueryHash', () => {
    it('should compute consistent hash for same query', () => {
      const query = 'query TestQuery { user { id name } }';
      const hash1 = computeQueryHash(query);
      const hash2 = computeQueryHash(query);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produces 64-character hex
    });

    it('should normalize query formatting', () => {
      const query1 = 'query TestQuery { user { id name } }';
      const query2 = `
        query TestQuery {
          user {
            id
            name
          }
        }
      `;
      
      const hash1 = computeQueryHash(query1);
      const hash2 = computeQueryHash(query2);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different queries', () => {
      const query1 = 'query Query1 { user { id } }';
      const query2 = 'query Query2 { user { name } }';
      
      const hash1 = computeQueryHash(query1);
      const hash2 = computeQueryHash(query2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for invalid query syntax', () => {
      const invalidQuery = 'this is not a valid query';
      
      expect(() => computeQueryHash(invalidQuery)).toThrow();
    });
  });

  describe('generateManifest', () => {
    it('should generate empty manifest for empty directory', () => {
      const manifest = generateManifest({
        queriesDir: testDir,
        outputPath,
        includeQueryText: true,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      expect(manifest.version).toBe(1);
      expect(manifest.count).toBe(0);
      expect(manifest.queries).toEqual([]);
      expect(manifest.hashMap).toEqual({});
    });

    it('should generate manifest with single query', () => {
      // Create test query file
      const queryContent = `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            username
          }
        }
      `;
      fs.writeFileSync(path.join(testDir, 'GetUser.graphql'), queryContent);

      const manifest = generateManifest({
        queriesDir: testDir,
        outputPath,
        includeQueryText: true,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      expect(manifest.version).toBe(1);
      expect(manifest.count).toBe(1);
      expect(manifest.queries).toHaveLength(1);
      
      const query = manifest.queries[0];
      expect(query.name).toBe('GetUser');
      expect(query.operationType).toBe('query');
      expect(query.hash).toBeDefined();
      expect(query.hash).toHaveLength(64);
      expect(query.query).toContain('GetUser');
      expect(query.filePath).toBe('GetUser.graphql');
      
      expect(manifest.hashMap[query.hash]).toBe('GetUser');
    });

    it('should handle multiple queries', () => {
      // Create multiple test query files
      fs.writeFileSync(
        path.join(testDir, 'GetUser.graphql'),
        'query GetUser { user { id } }'
      );
      fs.writeFileSync(
        path.join(testDir, 'CreateUser.graphql'),
        'mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }'
      );
      fs.writeFileSync(
        path.join(testDir, 'UserUpdated.graphql'),
        'subscription UserUpdated { userUpdated { id } }'
      );

      const manifest = generateManifest({
        queriesDir: testDir,
        outputPath,
        includeQueryText: true,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      expect(manifest.count).toBe(3);
      expect(manifest.queries).toHaveLength(3);
      
      const operationTypes = manifest.queries.map(q => q.operationType);
      expect(operationTypes).toContain('query');
      expect(operationTypes).toContain('mutation');
      expect(operationTypes).toContain('subscription');
    });

    it('should handle nested directories', () => {
      // Create nested structure
      const nestedDir = path.join(testDir, 'users');
      fs.mkdirSync(nestedDir, { recursive: true });
      
      fs.writeFileSync(
        path.join(nestedDir, 'GetUser.graphql'),
        'query GetUser { user { id } }'
      );

      const manifest = generateManifest({
        queriesDir: testDir,
        outputPath,
        includeQueryText: true,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      expect(manifest.count).toBe(1);
      expect(manifest.queries[0].filePath).toBe(path.join('users', 'GetUser.graphql'));
    });

    it('should exclude query text when includeQueryText is false', () => {
      fs.writeFileSync(
        path.join(testDir, 'GetUser.graphql'),
        'query GetUser { user { id } }'
      );

      const manifest = generateManifest({
        queriesDir: testDir,
        outputPath,
        includeQueryText: false,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      expect(manifest.queries[0].query).toBe('');
    });

    it('should reject duplicate query hashes', () => {
      // Create two files with identical queries
      const queryContent = 'query GetUser { user { id } }';
      fs.writeFileSync(path.join(testDir, 'GetUser1.graphql'), queryContent);
      fs.writeFileSync(path.join(testDir, 'GetUser2.graphql'), queryContent);

      expect(() => {
        generateManifest({
          queriesDir: testDir,
          outputPath,
          includeQueryText: true,
          hashAlgorithm: 'sha256',
          verbose: false,
        });
      }).toThrow('Duplicate query hashes');
    });

    it('should handle .gql extension', () => {
      fs.writeFileSync(
        path.join(testDir, 'GetUser.gql'),
        'query GetUser { user { id } }'
      );

      const manifest = generateManifest({
        queriesDir: testDir,
        outputPath,
        includeQueryText: true,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      expect(manifest.count).toBe(1);
    });

    it('should include timestamp in manifest', () => {
      fs.writeFileSync(
        path.join(testDir, 'GetUser.graphql'),
        'query GetUser { user { id } }'
      );

      const manifest = generateManifest({
        queriesDir: testDir,
        outputPath,
        includeQueryText: true,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      expect(manifest.generatedAt).toBeDefined();
      expect(new Date(manifest.generatedAt)).toBeInstanceOf(Date);
    });

    it('should create hash map correctly', () => {
      fs.writeFileSync(
        path.join(testDir, 'GetUser.graphql'),
        'query GetUser { user { id } }'
      );
      fs.writeFileSync(
        path.join(testDir, 'GetFleet.graphql'),
        'query GetFleet { fleet { id } }'
      );

      const manifest = generateManifest({
        queriesDir: testDir,
        outputPath,
        includeQueryText: true,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      expect(Object.keys(manifest.hashMap)).toHaveLength(2);
      
      for (const query of manifest.queries) {
        expect(manifest.hashMap[query.hash]).toBe(query.name);
      }
    });
  });

  describe('error handling', () => {
    it('should skip invalid query files', () => {
      fs.writeFileSync(
        path.join(testDir, 'Invalid.graphql'),
        'this is not valid GraphQL'
      );
      fs.writeFileSync(
        path.join(testDir, 'Valid.graphql'),
        'query Valid { user { id } }'
      );

      const manifest = generateManifest({
        queriesDir: testDir,
        outputPath,
        includeQueryText: true,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      // Should only include the valid query
      expect(manifest.count).toBe(1);
      expect(manifest.queries[0].name).toBe('Valid');
    });

    it('should handle non-existent directory', () => {
      const nonExistentDir = path.join(__dirname, 'does-not-exist');
      
      const manifest = generateManifest({
        queriesDir: nonExistentDir,
        outputPath,
        includeQueryText: true,
        hashAlgorithm: 'sha256',
        verbose: false,
      });

      expect(manifest.count).toBe(0);
      expect(manifest.queries).toEqual([]);
    });
  });
});

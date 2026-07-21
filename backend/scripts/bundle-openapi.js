/**
 * Bundle OpenAPI Specification
 *
 * This script bundles the multi-file OpenAPI specification into a single file
 * by resolving all $ref references. This is necessary for swagger-ui-express
 * to properly display the API documentation.
 *
 * Usage: node scripts/bundle-openapi.js
 */

const SwaggerParser = require('@apidevtools/swagger-parser');
const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');

const INPUT_FILE = path.join(__dirname, '../openapi/api.yaml');
const OUTPUT_FILE = path.join(__dirname, '../openapi/api-bundled.yaml');

async function bundleOpenAPI() {
  try {
    console.log('Loading OpenAPI specification from:', INPUT_FILE);

    // Load and parse the spec
    const rawSpec = YAML.load(fs.readFileSync(INPUT_FILE, 'utf8'));

    // Temporarily change version to 3.0.3 for swagger-parser compatibility
    const tempSpec = { ...rawSpec, openapi: '3.0.3' };

    // Write temp file for swagger-parser to read
    const tempPath = path.join(__dirname, '../openapi/api-temp.yaml');
    fs.writeFileSync(tempPath, YAML.dump(tempSpec), 'utf8');

    // Dereference (bundle) all $ref references
    console.log('Resolving $ref references...');
    const bundledSpec = await SwaggerParser.dereference(tempPath);

    // Clean up temp file
    fs.unlinkSync(tempPath);

    // Restore original version
    bundledSpec.openapi = rawSpec.openapi;

    // Write bundled spec to output file
    console.log('Writing bundled specification to:', OUTPUT_FILE);
    fs.writeFileSync(OUTPUT_FILE, YAML.dump(bundledSpec, { lineWidth: -1 }), 'utf8');

    console.log('✓ OpenAPI specification bundled successfully!');
    console.log(`  Paths: ${Object.keys(bundledSpec.paths || {}).length}`);
    console.log(`  Schemas: ${Object.keys(bundledSpec.components?.schemas || {}).length}`);
  } catch (error) {
    console.error('✗ Error bundling OpenAPI specification:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

bundleOpenAPI();

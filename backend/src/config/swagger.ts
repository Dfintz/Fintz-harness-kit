import * as fs from 'fs';
import * as path from 'path';

import * as YAML from 'js-yaml';

import { logger } from '../utils/logger';

// Load the OpenAPI specification from YAML file
// We use the api-bundled spec which has all $ref resolved
const bundledPath = path.join(__dirname, '../../openapi/api-bundled.yaml');
let swaggerSpec: Record<string, unknown>;

try {
  const fileContents = fs.readFileSync(bundledPath, 'utf8');
  swaggerSpec = YAML.load(fileContents) as Record<string, unknown>;

  // swagger-ui-express only fully supports OpenAPI 3.0.x
  // Downgrade version number for compatibility while keeping features
  if (swaggerSpec.openapi === '3.1.0') {
    swaggerSpec.openapi = '3.0.3';
  }

  logger.info('OpenAPI specification loaded successfully from bundled spec');
} catch (error) {
  logger.error('Error loading OpenAPI spec:', error);
  // Fallback to basic spec if file can't be loaded
  swaggerSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Star Citizen Fleet Manager API',
      version: '2.0.0',
      description: 'API temporarily unavailable - spec loading error',
    },
    paths: {},
    components: {
      schemas: {},
    },
  };
}

export { swaggerSpec };


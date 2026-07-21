/**
 * Example Decorated Controller
 * 
 * This demonstrates the route registration automation pattern.
 * Controllers can use decorators to define routes that are automatically
 * registered with Express.
 * 
 * @example
 * ```typescript
 * // In app.ts or a routes file:
 * import { registerControllers } from './routing';
 * import { ExampleController } from './controllers/ExampleController';
 * 
 * registerControllers(app, [ExampleController], {
 *   prefix: '/api/v3',
 *   debug: true,
 * });
 * ```
 */

import { Request, Response } from 'express';
import { injectable } from 'tsyringe';

import { Controller, Get, Post, Put, Delete, UseMiddleware } from '../routing';
import { logger } from '../utils/logger';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';

import { BaseController } from './BaseController';

/**
 * Example middleware for demonstration
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const logRequest = (req: Request, res: Response, next: Function) => {
  logger.debug(`Request: ${req.method} ${req.path}`);
  next();
};

/**
 * Example Controller demonstrating decorated routes
 * 
 * Routes:
 * - GET /api/v3/examples - List all examples
 * - GET /api/v3/examples/:id - Get example by ID
 * - POST /api/v3/examples - Create new example
 * - PUT /api/v3/examples/:id - Update example
 * - DELETE /api/v3/examples/:id - Delete example
 */
@injectable()
@Controller('/examples')
export class ExampleController extends BaseController {
  
  /**
   * List all examples
   * GET /examples
   */
  @Get('/')
  @UseMiddleware(logRequest)
  async list(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => ({
        message: 'List of examples',
        data: [],
        meta: {
          page: 1,
          limit: 10,
          total: 0,
        },
      }));
  }
  
  /**
   * Get example by ID
   * GET /examples/:id
   */
  @Get('/:id')
  async getById(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      return {
        message: `Get example ${id}`,
        data: { id },
      };
    });
  }
  
  /**
   * Create new example
   * POST /examples
   */
  @Post('/')
  async create(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => ({
        message: 'Example created',
        data: req.body,
      }), 201);
  }
  
  /**
   * Update example
   * PUT /examples/:id
   */
  @Put('/:id')
  async update(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      return {
        message: `Example ${id} updated`,
        data: { id, ...sanitizeObject(req.body as Record<string, unknown>) },
      };
    });
  }
  
  /**
   * Delete example
   * DELETE /examples/:id
   */
  @Delete('/:id')
  async delete(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => null, 204);
  }
}

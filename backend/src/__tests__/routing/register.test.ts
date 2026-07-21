/**
 * Tests for Route Registration System
 */

import 'reflect-metadata';
import express, { Express } from 'express';
import request from 'supertest';

import {
  Controller,
  Get,
  Post,
  UseMiddleware,
  registerControllers,
} from '../../routing';

describe('Route Registration System', () => {
  let app: Express;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
  });
  
  describe('registerControllers', () => {
    it('should register routes from controller', async () => {
      @Controller('/items')
      class ItemController {
        @Get('/')
        list(req: express.Request, res: express.Response) {
          res.json({ items: [] });
        }
        
        @Get('/:id')
        getById(req: express.Request, res: express.Response) {
          res.json({ id: req.params.id });
        }
      }
      
      const routes = registerControllers(app, [ItemController]);
      
      expect(routes).toHaveLength(2);
      expect(routes[0].method).toBe('GET');
      expect(routes[0].path).toBe('/items/');
      expect(routes[1].method).toBe('GET');
      expect(routes[1].path).toBe('/items/:id');
    });
    
    it('should handle requests to registered routes', async () => {
      @Controller('/test')
      class TestController {
        @Get('/')
        list(req: express.Request, res: express.Response) {
          res.json({ success: true });
        }
      }
      
      registerControllers(app, [TestController]);
      
      const response = await request(app).get('/test/');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should apply prefix to routes', async () => {
      @Controller('/users')
      class UserController {
        @Get('/')
        list(req: express.Request, res: express.Response) {
          res.json({ users: [] });
        }
      }
      
      const routes = registerControllers(app, [UserController], {
        prefix: '/api/v2',
      });
      
      expect(routes[0].path).toBe('/api/v2/users/');
      
      const response = await request(app).get('/api/v2/users/');
      expect(response.status).toBe(200);
    });
    
    it('should apply middleware to routes', async () => {
      const middlewareCalled = jest.fn();
      const testMiddleware = (req: any, res: any, next: any) => {
        middlewareCalled();
        next();
      };
      
      @Controller('/test')
      class TestController {
        @Get('/')
        @UseMiddleware(testMiddleware)
        list(req: express.Request, res: express.Response) {
          res.json({ success: true });
        }
      }
      
      registerControllers(app, [TestController]);
      
      await request(app).get('/test/');
      expect(middlewareCalled).toHaveBeenCalled();
    });
    
    it('should apply global middleware to all routes', async () => {
      const globalMiddlewareCalled = jest.fn();
      const globalMiddleware = (req: any, res: any, next: any) => {
        globalMiddlewareCalled();
        next();
      };
      
      @Controller('/test')
      class TestController {
        @Get('/a')
        routeA(req: express.Request, res: express.Response) {
          res.json({ route: 'a' });
        }
        
        @Get('/b')
        routeB(req: express.Request, res: express.Response) {
          res.json({ route: 'b' });
        }
      }
      
      registerControllers(app, [TestController], {
        globalMiddleware: [globalMiddleware],
      });
      
      await request(app).get('/test/a');
      await request(app).get('/test/b');
      
      expect(globalMiddlewareCalled).toHaveBeenCalledTimes(2);
    });
    
    it('should handle POST requests with body', async () => {
      @Controller('/items')
      class ItemController {
        @Post('/')
        create(req: express.Request, res: express.Response) {
          res.status(201).json({ created: req.body });
        }
      }
      
      registerControllers(app, [ItemController]);
      
      const response = await request(app)
        .post('/items/')
        .send({ name: 'Test Item' });
      
      expect(response.status).toBe(201);
      expect(response.body.created.name).toBe('Test Item');
    });
    
    it('should handle async route handlers', async () => {
      @Controller('/async')
      class AsyncController {
        @Get('/')
        async getData(req: express.Request, res: express.Response) {
          await new Promise(resolve => setTimeout(resolve, 10));
          res.json({ async: true });
        }
      }
      
      registerControllers(app, [AsyncController]);
      
      const response = await request(app).get('/async/');
      expect(response.status).toBe(200);
      expect(response.body.async).toBe(true);
    });
    
    it('should register multiple controllers', async () => {
      @Controller('/users')
      class UserController {
        @Get('/')
        list(req: express.Request, res: express.Response) {
          res.json({ type: 'users' });
        }
      }
      
      @Controller('/items')
      class ItemController {
        @Get('/')
        list(req: express.Request, res: express.Response) {
          res.json({ type: 'items' });
        }
      }
      
      const routes = registerControllers(app, [UserController, ItemController]);
      
      expect(routes).toHaveLength(2);
      
      const usersResponse = await request(app).get('/users/');
      expect(usersResponse.body.type).toBe('users');
      
      const itemsResponse = await request(app).get('/items/');
      expect(itemsResponse.body.type).toBe('items');
    });
    
    it('should return registered route information', () => {
      @Controller('/test')
      class TestController {
        @Get('/route')
        testRoute(req: express.Request, res: express.Response) {
          res.json({});
        }
      }
      
      const routes = registerControllers(app, [TestController]);
      
      expect(routes[0]).toEqual({
        method: 'GET',
        path: '/test/route',
        controller: 'TestController',
        handler: 'testRoute',
      });
    });
  });
});

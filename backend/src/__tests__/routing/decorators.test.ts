/**
 * Tests for Route Registration Decorators
 */

import 'reflect-metadata';

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  UseMiddleware,
  CONTROLLER_KEY,
  ROUTES_KEY,
  getControllerRoutes,
  getControllerBasePath,
} from '../../routing';

describe('Route Registration Decorators', () => {
  describe('@Controller', () => {
    it('should set controller path metadata', () => {
      @Controller('/api/test')
      class TestController {}
      
      const basePath = Reflect.getMetadata(CONTROLLER_KEY, TestController);
      expect(basePath).toBe('/api/test');
    });
    
    it('should use empty string for default path', () => {
      @Controller()
      class TestController {}
      
      const basePath = Reflect.getMetadata(CONTROLLER_KEY, TestController);
      expect(basePath).toBe('');
    });
    
    it('should initialize empty routes array', () => {
      @Controller('/test')
      class TestController {}
      
      const routes = Reflect.getMetadata(ROUTES_KEY, TestController);
      expect(routes).toEqual([]);
    });
  });
  
  describe('HTTP Method Decorators', () => {
    it('@Get should register GET route', () => {
      @Controller('/test')
      class TestController {
        @Get('/items')
        getItems() {}
      }
      
      const routes = getControllerRoutes(TestController);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('get');
      expect(routes[0].path).toBe('/items');
      expect(routes[0].handlerName).toBe('getItems');
    });
    
    it('@Post should register POST route', () => {
      @Controller('/test')
      class TestController {
        @Post('/items')
        createItem() {}
      }
      
      const routes = getControllerRoutes(TestController);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('post');
    });
    
    it('@Put should register PUT route', () => {
      @Controller('/test')
      class TestController {
        @Put('/items/:id')
        updateItem() {}
      }
      
      const routes = getControllerRoutes(TestController);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('put');
    });
    
    it('@Patch should register PATCH route', () => {
      @Controller('/test')
      class TestController {
        @Patch('/items/:id')
        patchItem() {}
      }
      
      const routes = getControllerRoutes(TestController);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('patch');
    });
    
    it('@Delete should register DELETE route', () => {
      @Controller('/test')
      class TestController {
        @Delete('/items/:id')
        deleteItem() {}
      }
      
      const routes = getControllerRoutes(TestController);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('delete');
    });
    
    it('should register multiple routes on same controller', () => {
      @Controller('/test')
      class TestController {
        @Get('/')
        list() {}
        
        @Get('/:id')
        getById() {}
        
        @Post('/')
        create() {}
        
        @Put('/:id')
        update() {}
        
        @Delete('/:id')
        delete() {}
      }
      
      const routes = getControllerRoutes(TestController);
      expect(routes).toHaveLength(5);
    });
  });
  
  describe('@UseMiddleware', () => {
    it('should attach middleware to route', () => {
      const mockMiddleware = jest.fn();
      
      @Controller('/test')
      class TestController {
        @Get('/items')
        @UseMiddleware(mockMiddleware)
        getItems() {}
      }
      
      const routes = getControllerRoutes(TestController);
      expect(routes[0].middleware).toContain(mockMiddleware);
    });
    
    it('should support multiple middleware', () => {
      const middleware1 = jest.fn();
      const middleware2 = jest.fn();
      
      @Controller('/test')
      class TestController {
        @Get('/items')
        @UseMiddleware(middleware1, middleware2)
        getItems() {}
      }
      
      const routes = getControllerRoutes(TestController);
      expect(routes[0].middleware).toHaveLength(2);
      expect(routes[0].middleware).toContain(middleware1);
      expect(routes[0].middleware).toContain(middleware2);
    });
  });
  
  describe('getControllerBasePath', () => {
    it('should return controller base path', () => {
      @Controller('/api/v2/users')
      class UserController {}
      
      expect(getControllerBasePath(UserController)).toBe('/api/v2/users');
    });
  });
  
  describe('getControllerRoutes', () => {
    it('should return all routes for controller', () => {
      @Controller('/users')
      class UserController {
        @Get('/')
        list() {}
        
        @Post('/')
        create() {}
      }
      
      const routes = getControllerRoutes(UserController);
      expect(routes).toHaveLength(2);
    });
    
    it('should return empty array for controller without routes', () => {
      @Controller('/empty')
      class EmptyController {}
      
      const routes = getControllerRoutes(EmptyController);
      expect(routes).toEqual([]);
    });
  });
});

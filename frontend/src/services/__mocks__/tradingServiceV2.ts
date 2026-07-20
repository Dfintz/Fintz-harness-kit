/**
 * Mock for tradingServiceV2
 */

export const tradingServiceV2 = {
  // V2 methods
  getRoutes: jest.fn(),
  createRoute: jest.fn(),
  getAnalytics: jest.fn(),
  getRouteById: jest.fn(),
  updateRoute: jest.fn(),
  deleteRoute: jest.fn(),
  getOpportunities: jest.fn(),
  getMarketAnalysis: jest.fn(),
  searchRoutes: jest.fn(),
  getActiveRoutes: jest.fn(),
  getHighProfitOpportunities: jest.fn(),
  getOpportunitiesForShip: jest.fn(),
  updateRouteStatus: jest.fn(),
  activateRoute: jest.fn(),
  deactivateRoute: jest.fn(),
  deprecateRoute: jest.fn(),
};

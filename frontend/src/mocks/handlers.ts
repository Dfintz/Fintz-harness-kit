import { http, HttpResponse } from 'msw';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE_URL}/api/auth/login`, () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
      },
    });
  }),

  http.get(`${API_BASE_URL}/api/users/me`, () => {
    return HttpResponse.json({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
      permissions: [],
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  // Fleet endpoints
  http.get(`${API_BASE_URL}/api/fleets`, () => {
    return HttpResponse.json([
      {
        id: '1',
        name: 'Test Fleet',
        organizationId: 'org1',
        status: 'active',
        shipCount: 5,
      },
    ]);
  }),

  http.get(`${API_BASE_URL}/api/fleets/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Fleet',
      organizationId: 'org1',
      status: 'active',
      ships: [],
    });
  }),

  // Organization endpoints
  http.get(`${API_BASE_URL}/api/organizations`, () => {
    return HttpResponse.json([
      {
        id: 'org1',
        name: 'Test Organization',
        tag: 'TEST',
        memberCount: 10,
        status: 'active',
      },
    ]);
  }),

  // Ship endpoints
  http.get(`${API_BASE_URL}/api/ships`, () => {
    return HttpResponse.json([
      {
        id: '1',
        name: 'Aurora MR',
        manufacturer: 'RSI',
        role: 'Starter',
        size: 'Small',
      },
    ]);
  }),

  // Event endpoints
  http.get(`${API_BASE_URL}/api/events`, () => {
    return HttpResponse.json([
      {
        id: '1',
        title: 'Test Event',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        organizationId: 'org1',
      },
    ]);
  }),

  // Mission endpoints
  http.get(`${API_BASE_URL}/api/missions`, () => {
    return HttpResponse.json([
      {
        id: '1',
        title: 'Test Mission',
        status: 'active',
        difficulty: 'medium',
        organizationId: 'org1',
      },
    ]);
  }),

  // Notifications endpoints
  http.get(`${API_BASE_URL}/api/notifications`, () => {
    return HttpResponse.json([
      {
        id: '1',
        message: 'Test notification',
        type: 'info',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  // Health check
  http.get(`${API_BASE_URL}/api/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }),
];

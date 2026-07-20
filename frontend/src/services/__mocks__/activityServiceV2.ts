/**
 * Mock for activityServiceV2
 */

export const activityServiceV2 = {
  // V2 methods
  getRecommendedActivities: jest.fn(),
  getUpcomingActivities: jest.fn(),
  getActivities: jest.fn(),
  createActivity: jest.fn(),
  getActivityAnalytics: jest.fn(),
  getActivityById: jest.fn(),
  updateActivity: jest.fn(),
  deleteActivity: jest.fn(),
  searchActivities: jest.fn(),
  getActivitiesByStatus: jest.fn(),
  getActivitiesByType: jest.fn(),
  getOpenActivities: jest.fn(),
  getRecruitingActivities: jest.fn(),
  joinActivity: jest.fn(),
  leaveActivity: jest.fn(),
  cancelActivity: jest.fn(),
};

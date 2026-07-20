"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockBriefings = void 0;
exports.paginateMockData = paginateMockData;
exports.filterMockBriefings = filterMockBriefings;
const Briefing_1 = require("../models/Briefing");
exports.mockBriefings = [
    {
        id: 'mock-briefing-1',
        title: 'Operation Steel Rain - Assault Mission',
        creatorId: 'user-1',
        missionId: 'mission-1',
        elements: [
            {
                id: 'element-1',
                type: 'text',
                position: { x: 100, y: 100 },
                data: { text: 'Primary Objective: Secure the outpost' }
            },
            {
                id: 'element-2',
                type: 'arrow',
                position: { x: 200, y: 200 },
                data: { endX: 400, endY: 200 }
            },
            {
                id: 'element-3',
                type: 'marker',
                position: { x: 400, y: 200 },
                data: {}
            }
        ],
        status: Briefing_1.BriefingStatus.ACTIVE,
        participants: ['user-1', 'user-2', 'user-3'],
        version: 1,
        tags: ['combat', 'assault', 'high-priority'],
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-01-20')
    },
    {
        id: 'mock-briefing-2',
        title: 'Mining Operation Beta',
        creatorId: 'user-2',
        missionId: 'mission-2',
        elements: [
            {
                id: 'element-4',
                type: 'text',
                position: { x: 150, y: 150 },
                data: { text: 'Mining Zone Alpha' }
            },
            {
                id: 'element-5',
                type: 'shape',
                position: { x: 300, y: 300 },
                data: { shape: 'circle', radius: 50 }
            }
        ],
        status: Briefing_1.BriefingStatus.DRAFT,
        participants: ['user-2'],
        version: 1,
        tags: ['mining', 'resource-gathering'],
        createdAt: new Date('2024-01-19'),
        updatedAt: new Date('2024-01-19')
    },
    {
        id: 'mock-briefing-3',
        title: 'Trade Route Scouting',
        creatorId: 'user-3',
        elements: [
            {
                id: 'element-6',
                type: 'line',
                position: { x: 100, y: 400 },
                data: { endX: 500, endY: 400 }
            },
            {
                id: 'element-7',
                type: 'text',
                position: { x: 300, y: 380 },
                data: { text: 'Primary Trade Route' }
            }
        ],
        status: Briefing_1.BriefingStatus.COMPLETED,
        participants: ['user-3', 'user-4'],
        version: 2,
        tags: ['trading', 'reconnaissance'],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-18')
    }
];
function paginateMockData(data, page = 1, limit = 10) {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);
    const total = data.length;
    const totalPages = Math.ceil(total / limit);
    return {
        data: paginatedData,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
}
function filterMockBriefings(filters) {
    let filtered = [...exports.mockBriefings];
    if (filters?.creatorId) {
        filtered = filtered.filter(b => b.creatorId === filters.creatorId);
    }
    if (filters?.missionId) {
        filtered = filtered.filter(b => b.missionId === filters.missionId);
    }
    if (filters?.status) {
        filtered = filtered.filter(b => b.status === filters.status);
    }
    if (filters?.tags && filters.tags.length > 0) {
        filtered = filtered.filter(b => b.tags && filters.tags.some(tag => b.tags.includes(tag)));
    }
    return filtered;
}
//# sourceMappingURL=mockData.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichActivityWithAvatars = enrichActivityWithAvatars;
const database_1 = require("../../config/database");
const User_1 = require("../../models/User");
function forEachCrewMember(assignments, fn) {
    for (const sa of assignments ?? []) {
        for (const c of sa.crew ?? []) {
            fn(c);
        }
        for (const c of sa.crewMembers ?? []) {
            fn(c);
        }
    }
}
function collectCrewUserIds(assignments, ids) {
    forEachCrewMember(assignments, c => {
        if (c.userId) {
            ids.add(c.userId);
        }
    });
}
function applyCrewAvatars(assignments, avatarMap) {
    forEachCrewMember(assignments, c => {
        const avatar = avatarMap.get(c.userId);
        if (avatar) {
            c.avatarUrl = avatar;
        }
    });
}
async function enrichActivityWithAvatars(activity) {
    const hasAssignments = (activity.shipAssignments?.length ?? 0) > 0;
    const hasShips = (activity.ships?.length ?? 0) > 0;
    if (!hasAssignments && !hasShips) {
        return;
    }
    const userIds = new Set();
    collectCrewUserIds(activity.shipAssignments, userIds);
    collectCrewUserIds(activity.ships, userIds);
    if (userIds.size === 0) {
        return;
    }
    const userRepo = database_1.AppDataSource.getRepository(User_1.User);
    const users = await userRepo
        .createQueryBuilder('user')
        .select(['user.id', 'user.avatar'])
        .where('user.id IN (:...userIds)', { userIds: [...userIds] })
        .getMany();
    const avatarMap = new Map(users.map(u => [u.id, u.avatar]));
    applyCrewAvatars(activity.shipAssignments, avatarMap);
    applyCrewAvatars(activity.ships, avatarMap);
}
//# sourceMappingURL=activityController.avatars.js.map
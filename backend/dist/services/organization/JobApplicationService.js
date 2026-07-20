"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobApplicationService = exports.NON_TERMINAL_STATUSES = exports.TERMINAL_STATUSES = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const JobApplication_1 = require("../../models/JobApplication");
const PublicJobListing_1 = require("../../models/PublicJobListing");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
exports.TERMINAL_STATUSES = [JobApplication_1.JobApplicationStatus.REJECTED, JobApplication_1.JobApplicationStatus.WITHDRAWN];
exports.NON_TERMINAL_STATUSES = [
    JobApplication_1.JobApplicationStatus.PENDING,
    JobApplication_1.JobApplicationStatus.WAITLISTED,
    JobApplication_1.JobApplicationStatus.APPROVED,
];
class JobApplicationService {
    applicationRepository;
    jobRepository;
    constructor() {
        this.applicationRepository = data_source_1.AppDataSource.getRepository(JobApplication_1.JobApplication);
        this.jobRepository = data_source_1.AppDataSource.getRepository(PublicJobListing_1.PublicJobListing);
    }
    async apply(input) {
        const job = await this.jobRepository.findOne({ where: { id: input.jobListingId } });
        if (!job) {
            throw new apiErrors_1.NotFoundError('Job listing');
        }
        if (!job.isActive) {
            throw new apiErrors_1.ConflictError('Job listing is no longer active');
        }
        if (job.expiresAt && new Date() > job.expiresAt) {
            throw new apiErrors_1.ConflictError('Job listing has expired');
        }
        const existing = await this.applicationRepository.findOne({
            where: {
                jobListingId: input.jobListingId,
                applicantUserId: input.applicantUserId,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)(exports.TERMINAL_STATUSES)),
            },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('You already have an active application for this listing');
        }
        const app = this.applicationRepository.create({
            jobListingId: input.jobListingId,
            applicantUserId: input.applicantUserId,
            applicantDisplayName: input.applicantDisplayName,
            applicationType: input.applicationType,
            message: input.message,
            formResponses: input.formResponses,
            status: JobApplication_1.JobApplicationStatus.PENDING,
        });
        switch (input.applicationType) {
            case JobApplication_1.JobApplicationType.CREW:
                this.populateCrewFields(app, job, input);
                break;
            case JobApplication_1.JobApplicationType.PASSENGER:
                this.populatePassengerFields(app, job, input);
                break;
            case JobApplication_1.JobApplicationType.VEHICLE:
                if (!input.vehicleName) {
                    throw new apiErrors_1.ValidationError('vehicleName is required for vehicle applications');
                }
                app.vehicleName = input.vehicleName;
                break;
            case JobApplication_1.JobApplicationType.GENERAL:
                break;
        }
        if (this.isListingFull(job) && input.applicationType !== JobApplication_1.JobApplicationType.VEHICLE) {
            app.status = JobApplication_1.JobApplicationStatus.WAITLISTED;
            app.waitlistPosition = await this.getNextWaitlistPosition(input.jobListingId);
        }
        const saved = await this.applicationRepository.save(app);
        logger_1.logger.info(`Job application submitted: ${saved.id}`, {
            jobListingId: input.jobListingId,
            applicantUserId: input.applicantUserId,
            type: input.applicationType,
            status: saved.status,
        });
        return saved;
    }
    async reviewApplication(applicationId, input) {
        const app = await this.applicationRepository.findOne({
            where: { id: applicationId },
            relations: ['jobListing'],
        });
        if (!app) {
            throw new apiErrors_1.NotFoundError('Application', applicationId);
        }
        if (input.jobListingId && app.jobListingId !== input.jobListingId) {
            throw new apiErrors_1.ValidationError('Application does not belong to this job listing');
        }
        if (app.status !== JobApplication_1.JobApplicationStatus.PENDING &&
            app.status !== JobApplication_1.JobApplicationStatus.WAITLISTED) {
            throw new apiErrors_1.ValidationError(`Cannot review an application in "${app.status}" status`);
        }
        app.status = input.status;
        app.reviewedBy = input.reviewedBy;
        app.reviewNote = input.reviewNote ?? undefined;
        app.reviewedAt = new Date();
        if (input.status === JobApplication_1.JobApplicationStatus.APPROVED && app.jobListing) {
            await this.fillSlot(app, app.jobListing);
        }
        if (input.status === JobApplication_1.JobApplicationStatus.WAITLISTED && !app.waitlistPosition) {
            app.waitlistPosition = await this.getNextWaitlistPosition(app.jobListingId);
        }
        const saved = await this.applicationRepository.save(app);
        logger_1.logger.info(`Application ${applicationId} reviewed: ${input.status}`, {
            reviewedBy: input.reviewedBy,
        });
        return saved;
    }
    async withdrawApplication(applicationId, userId) {
        const app = await this.applicationRepository.findOne({ where: { id: applicationId } });
        if (!app) {
            throw new apiErrors_1.NotFoundError('Application', applicationId);
        }
        if (app.applicantUserId !== userId) {
            throw new apiErrors_1.ForbiddenError('You can only withdraw your own application');
        }
        if (app.status === JobApplication_1.JobApplicationStatus.APPROVED ||
            app.status === JobApplication_1.JobApplicationStatus.WITHDRAWN) {
            throw new apiErrors_1.ConflictError(`Cannot withdraw an application in "${app.status}" status`);
        }
        app.status = JobApplication_1.JobApplicationStatus.WITHDRAWN;
        const saved = await this.applicationRepository.save(app);
        logger_1.logger.info(`Application ${applicationId} withdrawn by ${userId}`);
        return saved;
    }
    async getApplicationsForJob(jobListingId, status) {
        const where = { jobListingId };
        if (status) {
            where.status = status;
        }
        return this.applicationRepository.find({
            where,
            order: { createdAt: 'ASC' },
        });
    }
    async getApplicationsByUser(userId) {
        return this.applicationRepository.find({
            where: { applicantUserId: userId },
            order: { createdAt: 'DESC' },
        });
    }
    async hasUserApplied(userId, jobListingId) {
        return this.applicationRepository
            .createQueryBuilder('app')
            .where('app.applicantUserId = :userId', { userId })
            .andWhere('app.jobListingId = :jobListingId', { jobListingId })
            .andWhere('app.status NOT IN (:...terminal)', {
            terminal: [JobApplication_1.JobApplicationStatus.REJECTED, JobApplication_1.JobApplicationStatus.WITHDRAWN],
        })
            .getOne();
    }
    async getWaitlist(jobListingId) {
        return this.applicationRepository.find({
            where: { jobListingId, status: JobApplication_1.JobApplicationStatus.WAITLISTED },
            order: { waitlistPosition: 'ASC' },
        });
    }
    static toParticipantInfo(application) {
        const statusMap = {
            [JobApplication_1.JobApplicationStatus.PENDING]: 'pending',
            [JobApplication_1.JobApplicationStatus.WAITLISTED]: 'waitlisted',
            [JobApplication_1.JobApplicationStatus.APPROVED]: 'active',
            [JobApplication_1.JobApplicationStatus.REJECTED]: 'inactive',
            [JobApplication_1.JobApplicationStatus.WITHDRAWN]: 'inactive',
        };
        return {
            userId: application.applicantUserId,
            organizationId: undefined,
            username: application.applicantDisplayName,
            displayName: application.applicantDisplayName,
            roles: [shared_types_1.SystemRole.JOB_APPLICANT],
            primaryRole: application.applicationType,
            status: statusMap[application.status],
            joinedAt: application.createdAt,
            source: 'manual',
            metadata: {
                jobListingId: application.jobListingId,
                applicationId: application.id,
            },
        };
    }
    toParticipantInfo(application) {
        return JobApplicationService.toParticipantInfo(application);
    }
    populateCrewFields(app, job, input) {
        if (input.shipIndex === undefined || input.roleIndex === undefined) {
            throw new apiErrors_1.ValidationError('shipIndex and roleIndex are required for crew applications');
        }
        if (!job.shipCrewBreakdown?.[input.shipIndex]) {
            throw new apiErrors_1.ValidationError('Invalid ship index');
        }
        const ship = job.shipCrewBreakdown[input.shipIndex];
        const role = ship.roles[input.roleIndex];
        if (!role) {
            throw new apiErrors_1.ValidationError('Invalid role index');
        }
        if (role.filled >= role.total) {
        }
        app.shipIndex = input.shipIndex;
        app.roleIndex = input.roleIndex;
        app.shipName = ship.shipName;
        app.roleName = role.role;
    }
    populatePassengerFields(app, job, input) {
        if (input.passengerShipIndex === undefined) {
            throw new apiErrors_1.ValidationError('passengerShipIndex is required for passenger applications');
        }
        if (!job.shipCrewBreakdown?.[input.passengerShipIndex]) {
            throw new apiErrors_1.ValidationError('Invalid ship index for passenger');
        }
        const ship = job.shipCrewBreakdown[input.passengerShipIndex];
        app.passengerShipIndex = input.passengerShipIndex;
        app.shipName = ship.shipName;
        app.passengerRole = input.passengerRole ?? 'Passenger';
    }
    isListingFull(job) {
        if (!job.crewSpotsTotal) {
            return false;
        }
        return (job.crewSpotsFilled ?? 0) >= job.crewSpotsTotal;
    }
    async getNextWaitlistPosition(jobListingId) {
        const result = await this.applicationRepository
            .createQueryBuilder('app')
            .select('MAX(app.waitlistPosition)', 'maxPos')
            .where('app.jobListingId = :jobListingId', { jobListingId })
            .andWhere('app.status = :status', { status: JobApplication_1.JobApplicationStatus.WAITLISTED })
            .getRawOne();
        return (result?.maxPos ?? 0) + 1;
    }
    async fillSlot(app, job) {
        switch (app.applicationType) {
            case JobApplication_1.JobApplicationType.CREW:
                this.fillCrewSlot(app, job);
                break;
            case JobApplication_1.JobApplicationType.PASSENGER:
                this.fillPassengerSlot(app, job);
                break;
            default:
                job.crewSpotsFilled = (job.crewSpotsFilled ?? 0) + 1;
                if (app.applicationType === JobApplication_1.JobApplicationType.VEHICLE && app.vehicleName) {
                    job.approvedVehicles ??= [];
                    job.approvedVehicles.push({
                        vehicleName: app.vehicleName,
                        applicantUserId: app.applicantUserId,
                        applicantDisplayName: app.applicantDisplayName,
                        applicationId: app.id,
                        approvedAt: new Date().toISOString(),
                    });
                }
                break;
        }
        await this.jobRepository.save(job);
    }
    fillCrewSlot(app, job) {
        if (app.shipIndex === undefined || app.roleIndex === undefined || !job.shipCrewBreakdown) {
            return;
        }
        const ship = job.shipCrewBreakdown[app.shipIndex];
        if (!ship) {
            return;
        }
        const role = ship.roles[app.roleIndex];
        if (!role) {
            return;
        }
        role.assignedUserIds ??= [];
        role.assignedUserNames ??= [];
        if (role.assignedUserIds.length < role.total &&
            !role.assignedUserIds.includes(app.applicantUserId)) {
            role.assignedUserIds.push(app.applicantUserId);
            role.assignedUserNames.push(app.applicantDisplayName);
            role.filled = role.assignedUserIds.length;
            if (role.assignedUserIds.length === 1) {
                const legacyRole = role;
                legacyRole.assignedUserId = app.applicantUserId;
                legacyRole.assignedUserName = app.applicantDisplayName;
            }
        }
        job.crewSpotsFilled = job.shipCrewBreakdown.reduce((sum, s) => sum + s.roles.reduce((rs, r) => rs + r.filled, 0), 0);
    }
    fillPassengerSlot(app, job) {
        if (app.passengerShipIndex === undefined || !job.shipCrewBreakdown) {
            return;
        }
        const ship = job.shipCrewBreakdown[app.passengerShipIndex];
        if (!ship?.passengers) {
            return;
        }
        for (const pSlot of ship.passengers) {
            if (pSlot.filled < pSlot.capacity) {
                pSlot.filled += 1;
                pSlot.assignedUserNames ??= [];
                pSlot.assignedUserNames.push(app.applicantDisplayName);
                break;
            }
        }
    }
}
exports.JobApplicationService = JobApplicationService;
//# sourceMappingURL=JobApplicationService.js.map
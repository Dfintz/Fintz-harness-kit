import type { ProposalStatus } from '@sc-fleet-manager/shared-types';
import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { FederationAmbassadorService } from '../services/federation/FederationAmbassadorService';
import { FederationAnnouncementService } from '../services/federation/FederationAnnouncementService';
import { FederationApplicationService } from '../services/federation/FederationApplicationService';
import { FederationDiscordService } from '../services/federation/FederationDiscordService';
import { FederationDiscordSettingsService } from '../services/federation/FederationDiscordSettingsService';
import { FederationIntelService } from '../services/federation/FederationIntelService';
import { requireFederationPermission } from '../services/federation/federationPermissions';
import { FederationPersonnelService } from '../services/federation/FederationPersonnelService';
import { FederationPollService } from '../services/federation/FederationPollService';
import { FederationTeamService } from '../services/federation/FederationTeamService';
import { FederationWikiService } from '../services/federation/FederationWikiService';
import { OrganizationFederationService } from '../services/organization/OrganizationFederationService';
import { NotFoundError } from '../utils/apiErrors';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';

import { BaseController } from './BaseController';

/**
 * Federation (Alliance Enhancement) Controller
 *
 * Handles HTTP layer for federation CRUD, member management,
 * governance/voting, shared resources, treaties, analytics,
 * and the public directory.
 */
export class FederationController extends BaseController {
  private readonly federationService: OrganizationFederationService;
  private readonly ambassadorService: FederationAmbassadorService;
  private readonly wikiService: FederationWikiService;
  private readonly announcementService: FederationAnnouncementService;
  private readonly pollService: FederationPollService;
  private readonly teamService: FederationTeamService;
  private readonly intelService: FederationIntelService;
  private readonly personnelService: FederationPersonnelService;
  private readonly applicationService: FederationApplicationService;
  private readonly discordService: FederationDiscordService;
  private readonly discordSettingsService: FederationDiscordSettingsService;

  constructor() {
    super();
    this.federationService = OrganizationFederationService.getInstance();
    this.ambassadorService = FederationAmbassadorService.getInstance();
    this.wikiService = FederationWikiService.getInstance();
    this.announcementService = FederationAnnouncementService.getInstance();
    this.pollService = FederationPollService.getInstance();
    this.teamService = FederationTeamService.getInstance();
    this.intelService = FederationIntelService.getInstance();
    this.personnelService = FederationPersonnelService.getInstance();
    this.applicationService = FederationApplicationService.getInstance();
    this.discordService = FederationDiscordService.getInstance();
    this.discordSettingsService = FederationDiscordSettingsService.getInstance();
  }

  // ─── Federation CRUD ────────────────────────────────────────

  /** POST /federations */
  public create = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const authReq = req as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      const organizationId = this.getOrganizationId(authReq);

      // Org name is needed for the founder member record
      const orgName = authReq.user?.currentOrganizationName;

      const federation = await this.federationService.createFederation(
        userId,
        organizationId,
        orgName,
        req.body
      );

      res.status(201).json(federation);
    });
  };

  /** GET /federations/:id */
  public getById = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const federation = await this.federationService.getFederation(req.params.id);
      if (!federation) {
        throw new NotFoundError('Federation');
      }
      return federation;
    });
  };

  /** GET /federations/resolve-slug/:slug — resolve a slug to a federation ID */
  public resolveSlug = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const result = await this.federationService.resolveBySlug(req.params.slug);
      if (!result) {
        throw new NotFoundError('Federation');
      }
      return result;
    });
  };

  /** DELETE /federations/:id — disband a federation (founder only) */
  public disband = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      await this.federationService.disbandFederation(req.params.id, organizationId);
      res.status(204).send();
    });
  };

  /** GET /federations — list federations for the current org */
  public list = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.getOrganizationFederations(organizationId);
    });
  };

  /** GET /federations/search */
  public search = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.federationService.searchFederations({
        name: req.query.query as string | undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        minMembers: req.query.minMembers
          ? Number.parseInt(req.query.minMembers as string, 10)
          : undefined,
        maxMembers: req.query.maxMembers
          ? Number.parseInt(req.query.maxMembers as string, 10)
          : undefined,
      })
    );
  };

  /** PUT /federations/:id */
  public update = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.updateFederation(req.params.id, organizationId, req.body);
    });
  };

  /** PUT /federations/:id/activate */
  public activate = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.activateFederation(req.params.id, organizationId);
    });
  };

  /** PUT /federations/:id/succession-mode */
  public updateSuccessionMode = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.updateSuccessionMode(
        req.params.id,
        organizationId,
        req.body.successionMode,
        req.body.leaderTermDays
      );
    });
  };

  /** POST /federations/:id/succeed-chairman */
  public succeedChairman = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.succeedChairman(req.params.id, organizationId);
    });
  };

  // ─── Member Management ──────────────────────────────────────

  /** POST /federations/:id/members/invite */
  public inviteMember = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const member = await this.federationService.inviteMember(
        req.params.id,
        organizationId,
        req.body.targetOrgId,
        req.body.targetOrgName,
        req.body.role,
        req.body.associationType
      );
      res.status(201).json(member);
    });
  };

  /** POST /federations/:id/members/accept */
  public acceptInvitation = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.acceptInvitation(req.params.id, organizationId);
    });
  };

  /** DELETE /federations/:id/members/:memberId */
  public removeMember = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      await this.federationService.removeMember(
        req.params.id,
        organizationId, // actorOrgId — the authenticated caller
        req.params.memberId // targetOrgId — the member to remove
      );
      res.status(204).send();
    });
  };

  /** PUT /federations/:id/members/:memberId/role */
  public updateMemberRole = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.updateMemberRole(
        req.params.id,
        organizationId, // actorOrgId — the authenticated caller
        req.params.memberId, // targetOrgId — the member whose role to change
        req.body.role
      );
    });
  };

  // ─── Proposals & Voting ─────────────────────────────────────

  /** POST /federations/:id/proposals */
  public createProposal = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const authReq = req as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      const organizationId = this.getOrganizationId(authReq);

      const proposal = await this.federationService.createProposal(
        req.params.id,
        organizationId,
        userId, // used as proposer name
        req.body
      );
      res.status(201).json(proposal);
    });
  };

  /** POST /federations/:id/proposals/:proposalId/vote */
  public castVote = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authReq = req as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      const organizationId = this.getOrganizationId(authReq);

      // Resolve the voter's organization name from their federation membership
      const federation = await this.federationService.getFederation(req.params.id);
      const voterMember = federation?.members?.find(
        (m: { organizationId: string }) => m.organizationId === organizationId
      );
      const orgName = voterMember?.organizationName ?? `Organization ${organizationId.slice(0, 8)}`;

      return this.federationService.castVote(
        req.params.proposalId,
        organizationId,
        orgName,
        userId,
        req.body.vote,
        req.body.comment
      );
    });
  };

  /** GET /federations/:id/proposals/:proposalId */
  public getProposal = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const proposal = await this.federationService.getProposal(req.params.proposalId);
      if (!proposal) {
        throw new NotFoundError('Proposal');
      }
      return proposal;
    });
  };

  /** GET /federations/:id/proposals */
  public listProposals = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.federationService.getFederationProposals(
        req.params.id,
        req.query.status as ProposalStatus | undefined
      )
    );
  };

  // ─── Shared Resources ──────────────────────────────────────

  /** POST /federations/:id/resources */
  public addResource = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const resource = await this.federationService.addSharedResource(
        req.params.id,
        organizationId,
        {
          name: req.body.name,
          type: req.body.type,
          providedBy: organizationId,
          accessLevel: req.body.accessLevel,
          description: req.body.description,
        }
      );
      res.status(201).json(resource);
    });
  };

  /** DELETE /federations/:id/resources/:resourceId */
  public removeResource = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      await this.federationService.removeSharedResource(
        req.params.id,
        req.params.resourceId,
        organizationId
      );
      res.status(204).send();
    });
  };

  // ─── Treaties ───────────────────────────────────────────────

  /** POST /federations/:id/treaties */
  public createTreaty = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const treaty = await this.federationService.createTreaty(
        req.params.id,
        organizationId,
        req.body
      );
      res.status(201).json(treaty);
    });
  };

  /** DELETE /federations/:id/treaties/:treatyId */
  public terminateTreaty = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      await this.federationService.terminateTreaty(
        req.params.id,
        req.params.treatyId,
        organizationId
      );
      res.status(204).send();
    });
  };

  /** POST /federations/:id/treaties/:treatyId/respond */
  public respondToTreaty = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const treaty = await this.federationService.respondToTreaty(
        req.params.id,
        req.params.treatyId,
        organizationId,
        req.body.action
      );
      res.status(200).json(treaty);
    });
  };

  // ─── Analytics ──────────────────────────────────────────────

  /** GET /federations/:id/stats */
  public getStats = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.federationService.getFederationStats(req.params.id)
    );
  };

  /** GET /federations/:id/contributions */
  public getContributions = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.federationService.getMemberContributions(req.params.id)
    );
  };

  // ─── Settings ────────────────────────────────────────────────

  /** GET /federations/:id/settings */
  public getSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.getFederationSettings(req.params.id, organizationId);
    });
  };

  /** PUT /federations/:id/settings */
  public updateSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.updateFederationSettings(
        req.params.id,
        organizationId,
        req.body
      );
    });
  };

  // ─── Federation Fleets & Units ──────────────────────────────

  /** GET /federations/:id/fleets */
  public listFederationFleets = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.getFederationFleets(req.params.id, organizationId);
    });
  };

  /** GET /federations/:id/units */
  public listFederationUnits = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.federationService.getFederationUnits(req.params.id, organizationId);
    });
  };

  // ─── Public Directory (no auth) ─────────────────────────────

  /** GET /federations/public */
  public publicList = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const tags = req.query.tags;
      let parsedTags: string[] | undefined;
      if (Array.isArray(tags)) {
        parsedTags = tags as string[];
      } else if (tags) {
        parsedTags = [tags as string];
      }

      return this.federationService.getPublicFederations(
        {
          name: req.query.search as string | undefined,
          tags: parsedTags,
          minMembers: req.query.minMembers ? Number(req.query.minMembers) : undefined,
          maxMembers: req.query.maxMembers ? Number(req.query.maxMembers) : undefined,
        },
        {
          page: req.query.page ? Number(req.query.page) : 1,
          limit: Math.min(req.query.limit ? Number(req.query.limit) : 20, 200),
          sortBy: (req.query.sortBy as 'memberCount' | 'createdAt' | 'name') ?? 'memberCount',
          sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') ?? 'DESC',
        }
      );
    });
  };

  /** GET /federations/public/:id */
  public publicGet = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const federation = await this.federationService.getPublicFederation(req.params.id);
      if (!federation) {
        throw new NotFoundError('Federation');
      }
      return federation;
    });
  };

  /** GET /federations/public/stats */
  public publicStats = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.federationService.getPublicFederationStats()
    );
  };

  // ─── Ambassadors ──────────────────────────────────────────

  /** GET /federations/:id/ambassadors */
  public listAmbassadors = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.ambassadorService.listAmbassadors(req.params.id)
    );
  };

  /** POST /federations/:id/ambassadors */
  public appointAmbassador = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const ambassador = await this.ambassadorService.appointAmbassador(
        req.params.id,
        organizationId,
        req.body
      );
      res.status(201).json(ambassador);
    });
  };

  /** PUT /federations/:id/ambassadors/:ambId */
  public updateAmbassador = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.ambassadorService.updateAmbassador(
        req.params.id,
        req.params.ambId,
        organizationId,
        req.body
      );
    });
  };

  /** DELETE /federations/:id/ambassadors/:ambId */
  public removeAmbassador = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      await this.ambassadorService.removeAmbassador(
        req.params.id,
        req.params.ambId,
        organizationId
      );
      res.status(204).send();
    });
  };

  /** GET /federations/:id/ambassadors/me */
  public getMyAmbassadorProfile = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.ambassadorService.getMyAmbassadorProfile(req.params.id, userId);
    });
  };

  // ─── Federation Wiki ───────────────────────────────────────

  /** GET /federations/:id/wiki */
  public listWikiPages = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.wikiService.listPages(req.params.id, userId);
    });
  };

  /** GET /federations/:id/wiki/tree */
  public getWikiTree = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.wikiService.getPageTree(req.params.id, userId);
    });
  };

  /** GET /federations/:id/wiki/:pageId */
  public getWikiPage = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.wikiService.getPage(req.params.id, userId, req.params.pageId);
    });
  };

  /** POST /federations/:id/wiki */
  public createWikiPage = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      const page = await this.wikiService.createPage(req.params.id, userId, req.body);
      res.status(201).json(page);
    });
  };

  /** PUT /federations/:id/wiki/:pageId */
  public updateWikiPage = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.wikiService.updatePage(req.params.id, userId, req.params.pageId, req.body);
    });
  };

  /** DELETE /federations/:id/wiki/:pageId */
  public deleteWikiPage = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      await this.wikiService.deletePage(req.params.id, userId, req.params.pageId);
      res.status(204).send();
    });
  };

  // ─── Federation Announcements ────────────────────────────────

  /** GET /federations/:id/announcements */
  public listFederationAnnouncements = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.announcementService.listAnnouncements(req.params.id, userId);
    });
  };

  /** POST /federations/:id/announcements */
  public createFederationAnnouncement = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const authReq = req as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      const userName = (authReq.user as Record<string, unknown>)?.username as string | undefined;
      const body = sanitizeObject(req.body as Record<string, unknown>, [
        'title',
        'content',
        'targetAudience',
      ]);
      const announcement = await this.announcementService.createAnnouncement(
        req.params.id,
        userId,
        {
          title: body.title as string,
          content: body.content as string,
          targetAudience: body.targetAudience as 'all-members' | 'council' | 'public' | undefined,
          createdByName: userName,
        }
      );
      res.status(201).json(announcement);
    });
  };

  /** DELETE /federations/:id/announcements/:announcementId */
  public deleteFederationAnnouncement = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      await this.announcementService.deleteAnnouncement(
        req.params.id,
        userId,
        req.params.announcementId
      );
      res.status(204).send();
    });
  };

  /** PUT /federations/:id/announcements/:announcementId/pin */
  public toggleAnnouncementPin = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.announcementService.togglePin(req.params.id, userId, req.params.announcementId);
    });
  };

  /** POST /federations/:id/announcements/:announcementId/post */
  public postFederationAnnouncementToDiscord = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      const body = sanitizeObject(req.body as Record<string, unknown>, ['channelId']);
      return this.announcementService.postAnnouncementToDiscord(
        req.params.id,
        userId,
        req.params.announcementId,
        body.channelId as string
      );
    });
  };

  // ─── Federation Polls ────────────────────────────────────

  /** GET /federations/:id/polls */
  public listFederationPolls = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.pollService.listPolls(
        req.params.id,
        userId,
        req.query.status as string | undefined
      );
    });
  };

  /** POST /federations/:id/polls */
  public createFederationPoll = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const authReq = req as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      const userName = (authReq.user as Record<string, unknown>)?.username as string | undefined;
      const body = sanitizeObject(req.body as Record<string, unknown>, [
        'title',
        'description',
        'pollType',
        'options',
        'votingMode',
        'isAnonymous',
        'maxSelections',
        'endsAt',
      ]);
      const poll = await this.pollService.createPoll(req.params.id, userId, {
        title: body.title as string,
        description: body.description as string | undefined,
        pollType: body.pollType as string | undefined,
        options: body.options as Array<{ label: string; description?: string }>,
        votingMode: body.votingMode as 'equal' | 'weighted' | undefined,
        isAnonymous: body.isAnonymous as boolean | undefined,
        maxSelections: body.maxSelections as number | undefined,
        endsAt: body.endsAt as string | undefined,
        createdByName: userName,
      });
      res.status(201).json(poll);
    });
  };

  /** POST /federations/:id/polls/:pollId/vote */
  public castFederationVote = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.pollService.castVote(req.params.id, userId, req.params.pollId, req.body.optionId);
    });
  };

  /** GET /federations/:id/polls/:pollId/results */
  public getFederationPollResults = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.pollService.getResults(req.params.id, userId, req.params.pollId);
    });
  };

  /** PUT /federations/:id/polls/:pollId/close */
  public closeFederationPoll = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.pollService.closePoll(req.params.id, userId, req.params.pollId);
    });
  };

  /** DELETE /federations/:id/polls/:pollId */
  public deleteFederationPoll = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      await this.pollService.deletePoll(req.params.id, userId, req.params.pollId);
      res.status(204).send();
    });
  };

  /** POST /federations/:id/polls/:pollId/post */
  public postFederationPollToDiscord = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      const body = sanitizeObject(req.body as Record<string, unknown>, ['channelId']);
      return this.pollService.postPollToDiscord(
        req.params.id,
        userId,
        req.params.pollId,
        body.channelId as string
      );
    });
  };

  // ─── Federation Teams ────────────────────────────────────

  /** GET /federations/:id/teams */
  public listFederationTeams = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.teamService.listTeams(req.params.id, userId);
    });
  };

  /** GET /federations/:id/teams/:teamId */
  public getFederationTeam = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.teamService.getTeam(req.params.id, userId, req.params.teamId);
    });
  };

  /** POST /federations/:id/teams */
  public createFederationTeam = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      const team = await this.teamService.createTeam(req.params.id, userId, req.body);
      res.status(201).json(team);
    });
  };

  /** PUT /federations/:id/teams/:teamId */
  public updateFederationTeam = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.teamService.updateTeam(req.params.id, userId, req.params.teamId, req.body);
    });
  };

  /** POST /federations/:id/teams/:teamId/members */
  public addFederationTeamMember = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.teamService.addMember(req.params.id, userId, req.params.teamId, req.body);
    });
  };

  /** DELETE /federations/:id/teams/:teamId/members/:memberUserId */
  public removeFederationTeamMember = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.teamService.removeMember(
        req.params.id,
        userId,
        req.params.teamId,
        req.params.memberUserId
      );
    });
  };

  /** DELETE /federations/:id/teams/:teamId */
  public deleteFederationTeam = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      await this.teamService.deleteTeam(req.params.id, userId, req.params.teamId);
      res.status(204).send();
    });
  };

  // ─── Federation Intel ────────────────────────────────────

  /** GET /federations/:id/intel */
  public listFederationIntel = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.intelService.listIntel(req.params.id, userId, {
        classification: req.query.classification as string | undefined,
        status: req.query.status as string | undefined,
      });
    });
  };

  /** GET /federations/:id/intel/:intelId */
  public getFederationIntel = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.intelService.getIntel(req.params.id, userId, req.params.intelId);
    });
  };

  /** POST /federations/:id/intel */
  public submitFederationIntel = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const authReq = req as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      const userName = (authReq.user as Record<string, unknown>)?.username as string | undefined;
      const orgId = this.getOrganizationId(authReq);
      const body = sanitizeObject(req.body as Record<string, unknown>, [
        'title',
        'content',
        'classification',
        'tags',
        'visibleToTreaties',
      ]);
      const entry = await this.intelService.submitIntel(req.params.id, userId, {
        title: body.title as string,
        content: body.content as string,
        classification: body.classification as 'open' | 'restricted' | 'secret' | undefined,
        tags: body.tags as string[] | undefined,
        visibleToTreaties: body.visibleToTreaties as string[] | undefined,
        submittedByName: userName,
        submittedByOrgId: orgId,
      });
      res.status(201).json(entry);
    });
  };

  /** PUT /federations/:id/intel/:intelId */
  public updateFederationIntel = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.intelService.updateIntel(req.params.id, userId, req.params.intelId, req.body);
    });
  };

  /** PUT /federations/:id/intel/:intelId/approve */
  public approveFederationIntel = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.intelService.approveIntel(req.params.id, userId, req.params.intelId);
    });
  };

  /** PUT /federations/:id/intel/:intelId/archive */
  public archiveFederationIntel = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.intelService.archiveIntel(req.params.id, userId, req.params.intelId);
    });
  };

  /** DELETE /federations/:id/intel/:intelId */
  public deleteFederationIntel = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      await this.intelService.deleteIntel(req.params.id, userId, req.params.intelId);
      res.status(204).send();
    });
  };

  // ─── Federation Personnel ─────────────────────────────────

  /** GET /federations/:id/personnel */
  public listFederationPersonnel = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.personnelService.listPersonnel(req.params.id, userId);
    });
  };

  /** GET /federations/:id/personnel/summary */
  public getFederationPersonnelSummary = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.personnelService.getPersonnelSummary(req.params.id, userId);
    });
  };

  // ─── Federation Applications ───────────────────────────────

  /** GET /federations/:id/application-mode (public) */
  public getFederationApplicationMode = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.applicationService.getApplicationMode(req.params.id)
    );
  };

  /** POST /federations/:id/applications */
  public submitFederationApplication = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const authReq = req as AuthRequest;
      const userId = this.getAuthUser(authReq).id;
      const orgId = this.getOrganizationId(authReq);
      const orgName = authReq.user?.currentOrganizationName ?? 'Unknown Organization';
      const application = await this.applicationService.applyToFederation(
        req.params.id,
        userId,
        orgId,
        orgName,
        req.body
      );
      res.status(201).json(application);
    });
  };

  /** GET /federations/:id/applications */
  public listFederationApplications = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.applicationService.listApplications(req.params.id, userId, {
        status: req.query.status as string | undefined,
      });
    });
  };

  /** PUT /federations/:id/applications/:appId/review */
  public reviewFederationApplication = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.applicationService.reviewApplication(
        req.params.id,
        req.params.appId,
        userId,
        req.body.decision,
        req.body.note
      );
    });
  };

  /** DELETE /federations/:id/applications/:appId */
  public withdrawFederationApplication = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      await this.applicationService.withdrawApplication(req.params.id, req.params.appId, userId);
      res.status(204).send();
    });
  };

  // ─── Federation Discord Management ─────────────────────────

  /** GET /federations/:id/discord/status */
  public getFederationDiscordStatus = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => this.discordService.getStatus(req.params.id));
  };

  /** POST /federations/:id/discord/setup */
  public setupFederationDiscord = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.discordService.setupCentralGuild(
        req.params.id,
        userId,
        req.body.guildId,
        req.body.guildName
      );
    });
  };

  /** DELETE /federations/:id/discord */
  public unlinkFederationDiscord = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.discordService.unlinkCentralGuild(req.params.id, userId);
    });
  };

  /** GET /federations/:id/discord/conflicts */
  public getFederationDiscordConflicts = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.discordService.getConflictQueue(req.params.id, userId);
    });
  };

  /** POST /federations/:id/discord/conflicts/:discordUserId/resolve */
  public resolveFederationDiscordConflict = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      return this.discordService.resolveConflict(
        req.params.id,
        userId,
        req.params.discordUserId,
        req.body.chosenOrgId
      );
    });
  };

  /** POST /federations/:id/discord/sync-user */
  public syncFederationDiscordUser = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.getAuthUser(req as AuthRequest).id;
      await requireFederationPermission(
        this.ambassadorService,
        req.params.id,
        userId,
        'settings',
        'Ambassador settings permission required to sync Discord users'
      );
      return this.discordService.resolveUserRoles(req.params.id, req.body.discordUserId);
    });
  };

  // ─── Federation Discord Guild Settings ──────────────────────

  /** Require settings permission helper */
  private async requireSettingsPermission(req: Request): Promise<string> {
    const userId = this.getAuthUser(req as AuthRequest).id;
    await requireFederationPermission(
      this.ambassadorService,
      req.params.id,
      userId,
      'settings',
      'Ambassador settings permission required to manage guild settings'
    );
    return userId;
  }

  /** GET /federations/:id/discord/guild-settings */
  public getFederationGuildSettingsList = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      await this.requireSettingsPermission(req);
      const rows = await this.discordSettingsService.getAllForFederation(req.params.id);
      return rows.map(r => r.toDTO());
    });
  };

  /** GET /federations/:id/discord/guild-settings/:guildId */
  public getFederationGuildSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      await this.requireSettingsPermission(req);
      const settings = await this.discordSettingsService.getOrCreateSettings(
        req.params.id,
        req.params.guildId
      );
      return settings.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/event-settings */
  public updateFederationEventSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateEventSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/voice-channel-settings */
  public updateFederationVoiceChannelSettings = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateVoiceChannelSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/tunnel-settings */
  public updateFederationTunnelSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateTunnelSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/notification-preferences */
  public updateFederationNotificationPreferences = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateNotificationPreferences(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/role-sync-settings */
  public updateFederationRoleSyncSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateRoleSyncSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/cross-moderation-settings */
  public updateFederationCrossModerationSettings = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateCrossModerationSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/ticket-settings */
  public updateFederationTicketSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateTicketSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/team-voice-settings */
  public updateFederationTeamVoiceSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateTeamVoiceSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/lfg-settings */
  public updateFederationLfgSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateLfgSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/recruitment-settings */
  public updateFederationRecruitmentSettings = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateRecruitmentSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/welcome-settings */
  public updateFederationWelcomeSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateWelcomeSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/audit-log-settings */
  public updateFederationAuditLogSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateAuditLogSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/stat-settings */
  public updateFederationStatSettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateStatSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/dm-notification-settings */
  public updateFederationDmNotificationSettings = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateDmNotificationSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/smart-lfg-ping-settings */
  public updateFederationSmartLfgPingSettings = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateSmartLfgPingSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/giveaway-settings */
  public updateFederationGiveawaySettings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateGiveawaySettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** PATCH /federations/:id/discord/guild-settings/:guildId/advanced-event-settings */
  public updateFederationAdvancedEventSettings = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.updateAdvancedEventSettings(
        req.params.id,
        req.params.guildId,
        sanitizeObject(req.body),
        userId
      );
      return result.toDTO();
    });
  };

  /** POST /federations/:id/discord/guild-settings/:guildId/starcomms-managers */
  public addFederationStarCommsManagerRole = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const roleId = (req.body as { roleId: string }).roleId;
      const result = await this.discordSettingsService.addStarCommsManagerRole(
        req.params.id,
        req.params.guildId,
        roleId,
        userId
      );
      return result.toDTO();
    });
  };

  /** DELETE /federations/:id/discord/guild-settings/:guildId/starcomms-managers/:roleId */
  public removeFederationStarCommsManagerRole = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = await this.requireSettingsPermission(req);
      const result = await this.discordSettingsService.removeStarCommsManagerRole(
        req.params.id,
        req.params.guildId,
        req.params.roleId,
        userId
      );
      return result.toDTO();
    });
  };
}

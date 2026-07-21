import { GuildMember, User } from 'discord.js';

import { logger } from '../../utils/logger';

/**
 * Context used to resolve template variables
 */
export interface ShortcodeContext {
  user?: User | { id: string; username: string; displayName?: string; tag?: string };
  member?: GuildMember | { displayName: string; roles?: { cache: { size: number } } };
  guild?: { id: string; name: string; memberCount: number };
  organization?: { id: string; name: string; memberCount: number };
  ticket?: { number: string; subject: string; category: string; status: string };
  event?: { title: string; date: string; location: string; type: string; hostName: string };
  recruitment?: { title: string; position: string; status: string };
  lfg?: { activity: string; maxPlayers: number; currentPlayers: number };
  custom?: Record<string, string>;
}

/**
 * Variable/Shortcode resolution map
 * Keys are the shortcode names (e.g., "user.name"), values are resolver functions
 */
type Resolver = (ctx: ShortcodeContext) => string | undefined;

const RESOLVERS: Record<string, Resolver> = {
  // User variables
  'user.id': ctx => ctx.user?.id,
  'user.name': ctx => ctx.user?.username,
  'user.mention': ctx => (ctx.user ? `<@${ctx.user.id}>` : undefined),
  'user.tag': ctx => ('tag' in (ctx.user ?? {}) ? (ctx.user as User).tag : ctx.user?.username),

  // Member variables
  'member.displayname': ctx =>
    ctx.member ? ('displayName' in ctx.member ? ctx.member.displayName : undefined) : undefined,

  // Guild variables
  'guild.id': ctx => ctx.guild?.id,
  'guild.name': ctx => ctx.guild?.name,
  'guild.members': ctx => ctx.guild?.memberCount?.toString(),

  // Organization variables (for announcements and org-scoped features)
  'organization.id': ctx => ctx.organization?.id,
  'organization.name': ctx => ctx.organization?.name,
  'organization.members': ctx => ctx.organization?.memberCount?.toString(),

  // Ticket variables
  'ticket.number': ctx => ctx.ticket?.number,
  'ticket.subject': ctx => ctx.ticket?.subject,
  'ticket.category': ctx => ctx.ticket?.category,
  'ticket.status': ctx => ctx.ticket?.status,

  // Event variables
  'event.title': ctx => ctx.event?.title,
  'event.date': ctx => ctx.event?.date,
  'event.location': ctx => ctx.event?.location,
  'event.type': ctx => ctx.event?.type,
  'event.host': ctx => ctx.event?.hostName,

  // Recruitment variables
  'recruitment.title': ctx => ctx.recruitment?.title,
  'recruitment.position': ctx => ctx.recruitment?.position,
  'recruitment.status': ctx => ctx.recruitment?.status,

  // LFG variables
  'lfg.activity': ctx => ctx.lfg?.activity,
  'lfg.maxplayers': ctx => ctx.lfg?.maxPlayers?.toString(),
  'lfg.currentplayers': ctx => ctx.lfg?.currentPlayers?.toString(),

  // Utility variables
  'date.now': () => new Date().toLocaleDateString(),
  'date.iso': () => new Date().toISOString(),
  timestamp: () => `<t:${Math.floor(Date.now() / 1000)}:F>`,
  'timestamp.relative': () => `<t:${Math.floor(Date.now() / 1000)}:R>`,
};

/**
 * Shortcode Template Engine
 *
 * Resolves `{variable.name}` placeholders in template strings.
 * Supports user, guild, ticket, event, recruitment, LFG, and custom variables.
 *
 * Example: "Welcome, {user.mention}! Your ticket {ticket.number} has been created."
 */
export class ShortcodeEngine {
  private static instance: ShortcodeEngine;

  static getInstance(): ShortcodeEngine {
    if (!ShortcodeEngine.instance) {
      ShortcodeEngine.instance = new ShortcodeEngine();
    }
    return ShortcodeEngine.instance;
  }

  /**
   * Resolve all shortcodes in a template string
   */
  resolve(template: string, context: ShortcodeContext): string {
    if (!template) {
      return template;
    }

    return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (match, key: string) => {
      const normalizedKey = key.toLowerCase();

      // Check custom variables first
      if (context.custom?.[normalizedKey]) {
        return context.custom[normalizedKey];
      }

      // Check built-in resolvers
      const resolver = RESOLVERS[normalizedKey];
      if (resolver) {
        const value = resolver(context);
        if (value !== undefined) {
          return value;
        }
      }

      // Return original placeholder if not resolved
      return match;
    });
  }

  /**
   * Get a list of all available shortcodes
   */
  getAvailableShortcodes(): string[] {
    return Object.keys(RESOLVERS);
  }

  /**
   * Validate a template and return unresolvable shortcodes
   */
  validate(template: string): string[] {
    const shortcodes: string[] = [];
    const regex = /\{([a-zA-Z0-9_.]+)\}/g;
    let m: RegExpExecArray | null;

    while ((m = regex.exec(template)) !== null) {
      const key = m[1].toLowerCase();
      if (!RESOLVERS[key]) {
        shortcodes.push(m[1]);
      }
    }

    return shortcodes;
  }

  /**
   * Register a custom resolver (addon shortcodes)
   */
  registerResolver(key: string, resolver: Resolver): void {
    RESOLVERS[key.toLowerCase()] = resolver;
    logger.debug(`Shortcode registered: {${key}}`);
  }
}

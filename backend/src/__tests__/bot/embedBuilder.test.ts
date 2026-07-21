import { ColorResolvable } from 'discord.js';

import {
  createCapacityIndicator,
  createProgressBar,
  EmbedColors,
  formatDiscordTimestamp,
  formatRelativeTime,
  SCFleetEmbed,
  StatusDots,
  TimestampFormat,
} from '../../bot/utils/embedBuilder';

describe('EmbedBuilder Utilities', () => {
  describe('EmbedColors', () => {
    it('should have all required color constants', () => {
      expect(EmbedColors.SC_BLUE).toBeDefined();
      expect(EmbedColors.QUANTUM_GOLD).toBeDefined();
      expect(EmbedColors.SUCCESS).toBeDefined();
      expect(EmbedColors.ERROR).toBeDefined();
      expect(EmbedColors.WARNING).toBeDefined();
      expect(EmbedColors.INFO).toBeDefined();
    });

    it('should have correct hex values for brand colors', () => {
      expect(EmbedColors.SC_BLUE).toBe(0x00d4ff);
      expect(EmbedColors.QUANTUM_GOLD).toBe(0xf1c40f);
    });

    it('should have correct hex values for status colors', () => {
      expect(EmbedColors.SUCCESS).toBe(0x57f287);
      expect(EmbedColors.ERROR).toBe(0xed4245);
      expect(EmbedColors.WARNING).toBe(0xfee75c);
      expect(EmbedColors.INFO).toBe(0x5865f2);
    });

    it('should have organization relationship colors', () => {
      expect(EmbedColors.ALLIED).toBeDefined();
      expect(EmbedColors.NEUTRAL).toBeDefined();
      expect(EmbedColors.HOSTILE).toBeDefined();
    });
  });

  describe('StatusDots', () => {
    it('should have all status dot emojis', () => {
      expect(StatusDots.ONLINE).toBe('🟢');
      expect(StatusDots.AWAY).toBe('🟡');
      expect(StatusDots.BUSY).toBe('🔴');
      expect(StatusDots.OFFLINE).toBe('⚫');
      expect(StatusDots.PENDING).toBe('⚪');
    });
  });

  describe('formatDiscordTimestamp', () => {
    it('should format date with default relative format', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const result = formatDiscordTimestamp(date);
      expect(result).toMatch(/^<t:\d+:R>$/);
    });

    it('should format date with specified format', () => {
      const date = new Date('2025-01-15T12:00:00Z');

      expect(formatDiscordTimestamp(date, TimestampFormat.SHORT_TIME)).toMatch(/^<t:\d+:t>$/);
      expect(formatDiscordTimestamp(date, TimestampFormat.LONG_TIME)).toMatch(/^<t:\d+:T>$/);
      expect(formatDiscordTimestamp(date, TimestampFormat.SHORT_DATE)).toMatch(/^<t:\d+:d>$/);
      expect(formatDiscordTimestamp(date, TimestampFormat.LONG_DATE)).toMatch(/^<t:\d+:D>$/);
      expect(formatDiscordTimestamp(date, TimestampFormat.SHORT_DATETIME)).toMatch(/^<t:\d+:f>$/);
      expect(formatDiscordTimestamp(date, TimestampFormat.LONG_DATETIME)).toMatch(/^<t:\d+:F>$/);
    });

    it('should use correct unix timestamp', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const expectedTimestamp = Math.floor(date.getTime() / 1000);
      const result = formatDiscordTimestamp(date);
      expect(result).toBe(`<t:${expectedTimestamp}:R>`);
    });
  });

  describe('formatRelativeTime', () => {
    it('should return relative timestamp format', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const result = formatRelativeTime(date);
      expect(result).toMatch(/^<t:\d+:R>$/);
    });
  });

  describe('createProgressBar', () => {
    it('should render a gradient bar with percentage by default', () => {
      const result = createProgressBar(8, 10);
      // 8 filled cells flow red→orange→yellow→green, 2 empty cells, + percentage
      expect(result).toBe('🟥🟥🟧🟧🟧🟨🟨🟩⬛⬛ 80%');
    });

    it('should render an all-empty gradient bar at 0%', () => {
      const result = createProgressBar(0, 10);
      expect(result).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛ 0%');
    });

    it('should fill the gradient and end on green at 100%', () => {
      const result = createProgressBar(10, 10);
      expect(result).toBe('🟥🟥🟧🟧🟧🟨🟨🟩🟩🟩 100%');
    });

    it('should clamp current value to max (gradient)', () => {
      expect(createProgressBar(15, 10)).toBe('🟥🟥🟧🟧🟧🟨🟨🟩🟩🟩 100%');
    });

    it('should treat negative current value as empty (gradient)', () => {
      expect(createProgressBar(-5, 10)).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛ 0%');
    });

    it('should treat zero max value as empty (gradient)', () => {
      expect(createProgressBar(5, 0)).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛ 0%');
    });

    it('should render legacy block style when requested', () => {
      const result = createProgressBar(8, 10, { style: 'blocks' });
      expect(result).toBe('████████░░ 80%');
    });

    it('should handle custom width in block style', () => {
      const result = createProgressBar(5, 10, { style: 'blocks', width: 5 });
      // 50% of 5 = 2.5 which rounds to 3
      expect(result).toBe('███░░ 50%');
    });

    it('should handle custom characters in block style', () => {
      const result = createProgressBar(5, 10, {
        style: 'blocks',
        filledChar: '▓',
        emptyChar: '▒',
      });
      expect(result).toBe('▓▓▓▓▓▒▒▒▒▒ 50%');
    });

    it('should hide percentage when showPercentage is false', () => {
      const result = createProgressBar(5, 10, { style: 'blocks', showPercentage: false });
      expect(result).toBe('█████░░░░░');
    });
  });

  describe('createCapacityIndicator', () => {
    it('should show green indicator when under 75% capacity', () => {
      const result = createCapacityIndicator(5, 10);
      expect(result).toBe('🟢 5/10');
    });

    it('should show yellow indicator when at 75%+ capacity', () => {
      const result = createCapacityIndicator(8, 10);
      expect(result).toBe('🟡 8/10');
    });

    it('should show red indicator when full', () => {
      const result = createCapacityIndicator(10, 10);
      expect(result).toBe('🔴 10/10');
    });

    it('should show red indicator when over capacity', () => {
      const result = createCapacityIndicator(12, 10);
      expect(result).toBe('🔴 12/10');
    });

    it('should handle zero capacity', () => {
      const result = createCapacityIndicator(0, 0);
      expect(result).toBe('🟢 0/0');
    });
  });

  describe('SCFleetEmbed', () => {
    describe('factory methods', () => {
      it('should create basic embed', () => {
        const embed = SCFleetEmbed.create().setTitle('Test').build();
        expect(embed.data.title).toBe('Test');
      });

      it('should create info embed with correct color', () => {
        const embed = SCFleetEmbed.info('Test Title', 'Test Description').build();
        expect(embed.data.title).toBe('Test Title');
        expect(embed.data.description).toBe('Test Description');
        expect(embed.data.color).toBe(EmbedColors.INFO);
      });

      it('should create success embed with correct color and icon', () => {
        const embed = SCFleetEmbed.success('Success', 'It worked!').build();
        expect(embed.data.title).toBe('✅ Success');
        expect(embed.data.color).toBe(EmbedColors.SUCCESS);
      });

      it('should create error embed with correct color and icon', () => {
        const embed = SCFleetEmbed.error('Error', 'Something went wrong').build();
        expect(embed.data.title).toBe('❌ Error');
        expect(embed.data.color).toBe(EmbedColors.ERROR);
      });

      it('should create warning embed with correct color and icon', () => {
        const embed = SCFleetEmbed.warning('Warning', 'Be careful').build();
        expect(embed.data.title).toBe('⚠️ Warning');
        expect(embed.data.color).toBe(EmbedColors.WARNING);
      });

      it('should create event embed with correct color and icon', () => {
        const embed = SCFleetEmbed.event('Event', 'Join us!').build();
        expect(embed.data.title).toBe('📅 Event');
        expect(embed.data.color).toBe(EmbedColors.QUANTUM_GOLD);
      });

      it('should create fleet embed with correct color and icon', () => {
        const embed = SCFleetEmbed.fleet('Fleet Status', 'Ready for action').build();
        expect(embed.data.title).toBe('🚀 Fleet Status');
        expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
      });
    });

    describe('builder methods', () => {
      it('should chain methods correctly', () => {
        const embed = SCFleetEmbed.create()
          .setTitle('Test')
          .setDescription('Description')
          .setColor(0xff0000 as ColorResolvable)
          .addFields({ name: 'Field', value: 'Value' })
          .setFooter({ text: 'Footer' })
          .setTimestamp()
          .build();

        expect(embed.data.title).toBe('Test');
        expect(embed.data.description).toBe('Description');
        expect(embed.data.color).toBe(0xff0000);
        expect(embed.data.fields).toHaveLength(1);
        expect(embed.data.footer?.text).toBe('Footer');
        expect(embed.data.timestamp).toBeDefined();
      });

      it('should add progress field', () => {
        const embed = SCFleetEmbed.create().addProgressField('Progress', 8, 10).build();

        expect(embed.data.fields).toHaveLength(1);
        expect(embed.data.fields?.[0].name).toBe('Progress');
        expect(embed.data.fields?.[0].value).toBe('🟥🟥🟧🟧🟧🟨🟨🟩⬛⬛ 80%');
      });

      it('should add timestamp field', () => {
        const date = new Date('2025-01-15T12:00:00Z');
        const embed = SCFleetEmbed.create()
          .addTimestampField('Date', date, TimestampFormat.RELATIVE)
          .build();

        expect(embed.data.fields).toHaveLength(1);
        expect(embed.data.fields?.[0].name).toBe('Date');
        expect(embed.data.fields?.[0].value).toMatch(/^<t:\d+:R>$/);
      });
    });

    describe('toJSON', () => {
      it('should return valid JSON data', () => {
        const embed = SCFleetEmbed.success('Test', 'Description');
        const json = embed.toJSON();

        expect(json).toBeDefined();
        expect(json.title).toBe('✅ Test');
        expect(json.description).toBe('Description');
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

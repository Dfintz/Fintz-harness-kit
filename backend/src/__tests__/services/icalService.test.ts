import { ActivityCalendarService as ICalService } from '../../services/activity';
import { Event, RecurrencePattern } from '../../types';

describe('ICalService', () => {
    let icalService: ICalService;

    beforeEach(() => {
        icalService = new ICalService();
    });

    describe('generateICalEvent', () => {
        it('should generate valid iCal format for a simple event', () => {
            const event: Event = {
                id: 'event1',
                title: 'Fleet Meeting',
                description: 'Monthly fleet strategy meeting',
                date: new Date('2025-11-15T20:00:00Z'),
                location: 'Discord',
                attendees: [],
                organizerId: 'organizer1'
            };

            const icalData = icalService.generateICalEvent(event);

            expect(icalData).toContain('BEGIN:VCALENDAR');
            expect(icalData).toContain('END:VCALENDAR');
            expect(icalData).toContain('BEGIN:VEVENT');
            expect(icalData).toContain('END:VEVENT');
            expect(icalData).toContain('SUMMARY:Fleet Meeting');
            expect(icalData).toContain('DESCRIPTION:Monthly fleet strategy meeting');
            expect(icalData).toContain('LOCATION:Discord');
            expect(icalData).toContain('UID:event1@sc-fleet-manager');
            expect(icalData).toContain('ORGANIZER:organizer1');
        });

        it('should handle special characters in event data', () => {
            const event: Event = {
                id: 'event2',
                title: 'Test; Event, with\\special chars',
                description: 'Description with\nnewlines',
                date: new Date('2025-11-15T20:00:00Z'),
                location: 'Discord',
                attendees: []
            };

            const icalData = icalService.generateICalEvent(event);

            expect(icalData).toContain('SUMMARY:Test\\; Event\\, with\\\\special chars');
            expect(icalData).toContain('DESCRIPTION:Description with\\nnewlines');
        });

        it('should include recurrence rule for daily recurring event', () => {
            const event: Event = {
                id: 'event3',
                title: 'Daily Standup',
                description: 'Daily team standup',
                date: new Date('2025-11-01T10:00:00Z'),
                location: 'Discord',
                attendees: [],
                recurrencePattern: RecurrencePattern.DAILY,
                recurrenceEndDate: new Date('2025-11-30T10:00:00Z')
            };

            const icalData = icalService.generateICalEvent(event);

            expect(icalData).toContain('RRULE:FREQ=DAILY');
            expect(icalData).toContain('UNTIL=');
        });

        it('should include recurrence rule for weekly recurring event', () => {
            const event: Event = {
                id: 'event4',
                title: 'Weekly Meeting',
                description: 'Weekly team meeting',
                date: new Date('2025-11-01T10:00:00Z'),
                location: 'Discord',
                attendees: [],
                recurrencePattern: RecurrencePattern.WEEKLY
            };

            const icalData = icalService.generateICalEvent(event);

            expect(icalData).toContain('RRULE:FREQ=WEEKLY');
        });

        it('should include recurrence rule for monthly recurring event', () => {
            const event: Event = {
                id: 'event5',
                title: 'Monthly Review',
                description: 'Monthly team review',
                date: new Date('2025-11-01T10:00:00Z'),
                location: 'Discord',
                attendees: [],
                recurrencePattern: RecurrencePattern.MONTHLY
            };

            const icalData = icalService.generateICalEvent(event);

            expect(icalData).toContain('RRULE:FREQ=MONTHLY');
        });

        it('should not include recurrence rule for non-recurring event', () => {
            const event: Event = {
                id: 'event6',
                title: 'One-time Event',
                description: 'Single occurrence',
                date: new Date('2025-11-01T10:00:00Z'),
                location: 'Discord',
                attendees: []
            };

            const icalData = icalService.generateICalEvent(event);

            expect(icalData).not.toContain('RRULE');
        });
    });

    describe('generateICalCalendar', () => {
        it('should generate iCal format for multiple events', () => {
            const events: Event[] = [
                {
                    id: 'event1',
                    title: 'Event 1',
                    description: 'First event',
                    date: new Date('2025-11-15T20:00:00Z'),
                    location: 'Discord',
                    attendees: []
                },
                {
                    id: 'event2',
                    title: 'Event 2',
                    description: 'Second event',
                    date: new Date('2025-11-16T20:00:00Z'),
                    location: 'In-Game',
                    attendees: []
                }
            ];

            const icalData = icalService.generateICalCalendar(events);

            expect(icalData).toContain('BEGIN:VCALENDAR');
            expect(icalData).toContain('END:VCALENDAR');
            
            // Should contain both events
            const eventMatches = icalData.match(/BEGIN:VEVENT/g);
            expect(eventMatches).toHaveLength(2);
            
            expect(icalData).toContain('SUMMARY:Event 1');
            expect(icalData).toContain('SUMMARY:Event 2');
        });

        it('should handle empty event list', () => {
            const events: Event[] = [];

            const icalData = icalService.generateICalCalendar(events);

            expect(icalData).toContain('BEGIN:VCALENDAR');
            expect(icalData).toContain('END:VCALENDAR');
            expect(icalData).not.toContain('BEGIN:VEVENT');
        });

        it('should include recurrence rules in calendar export', () => {
            const events: Event[] = [
                {
                    id: 'event1',
                    title: 'Recurring Event',
                    description: 'Weekly meeting',
                    date: new Date('2025-11-01T10:00:00Z'),
                    location: 'Discord',
                    attendees: [],
                    recurrencePattern: RecurrencePattern.WEEKLY,
                    recurrenceEndDate: new Date('2025-12-01T10:00:00Z')
                }
            ];

            const icalData = icalService.generateICalCalendar(events);

            expect(icalData).toContain('RRULE:FREQ=WEEKLY');
            expect(icalData).toContain('UNTIL=');
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});

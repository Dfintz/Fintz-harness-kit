import { Event } from '../../types';

export class ICalService {
    /**
     * Generates an iCal format string for an event
     */
    public generateICalEvent(event: Event): string {
        const now = new Date();
        const dateFormat = (date: Date): string => `${date.toISOString().replace(/[-:]/g, '').split('.')[0]  }Z`;

        const escapeLine = (text: string): string => text
                .replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/\n/g, '\\n');

        const icalLines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Star Citizen Fleet Manager//Event//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${event.id}@sc-fleet-manager`,
            `DTSTAMP:${dateFormat(now)}`,
            `DTSTART:${dateFormat(new Date(event.date))}`,
            `SUMMARY:${escapeLine(event.title)}`,
            `DESCRIPTION:${escapeLine(event.description)}`,
            `LOCATION:${escapeLine(event.location)}`,
        ];

        if (event.organizerId) {
            icalLines.push(`ORGANIZER:${event.organizerId}`);
        }

        // Add recurrence rule if applicable
        if (event.recurrencePattern && event.recurrencePattern !== 'none') {
            let freq = '';
            switch (event.recurrencePattern) {
                case 'daily':
                    freq = 'DAILY';
                    break;
                case 'weekly':
                    freq = 'WEEKLY';
                    break;
                case 'monthly':
                    freq = 'MONTHLY';
                    break;
            }
            
            let rrule = `RRULE:FREQ=${freq}`;
            if (event.recurrenceEndDate) {
                rrule += `;UNTIL=${dateFormat(new Date(event.recurrenceEndDate))}`;
            }
            icalLines.push(rrule);
        }

        icalLines.push('END:VEVENT');
        icalLines.push('END:VCALENDAR');

        return icalLines.join('\r\n');
    }

    /**
     * Generates an iCal format string for multiple events
     */
    public generateICalCalendar(events: Event[]): string {
        const now = new Date();
        const dateFormat = (date: Date): string => `${date.toISOString().replace(/[-:]/g, '').split('.')[0]  }Z`;

        const escapeLine = (text: string): string => text
                .replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/\n/g, '\\n');

        const icalLines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Star Citizen Fleet Manager//Events//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
        ];

        events.forEach(event => {
            icalLines.push('BEGIN:VEVENT');
            icalLines.push(`UID:${event.id}@sc-fleet-manager`);
            icalLines.push(`DTSTAMP:${dateFormat(now)}`);
            icalLines.push(`DTSTART:${dateFormat(new Date(event.date))}`);
            icalLines.push(`SUMMARY:${escapeLine(event.title)}`);
            icalLines.push(`DESCRIPTION:${escapeLine(event.description)}`);
            icalLines.push(`LOCATION:${escapeLine(event.location)}`);

            if (event.organizerId) {
                icalLines.push(`ORGANIZER:${event.organizerId}`);
            }

            if (event.recurrencePattern && event.recurrencePattern !== 'none') {
                let freq = '';
                switch (event.recurrencePattern) {
                    case 'daily':
                        freq = 'DAILY';
                        break;
                    case 'weekly':
                        freq = 'WEEKLY';
                        break;
                    case 'monthly':
                        freq = 'MONTHLY';
                        break;
                }
                
                let rrule = `RRULE:FREQ=${freq}`;
                if (event.recurrenceEndDate) {
                    rrule += `;UNTIL=${dateFormat(new Date(event.recurrenceEndDate))}`;
                }
                icalLines.push(rrule);
            }

            icalLines.push('END:VEVENT');
        });

        icalLines.push('END:VCALENDAR');

        return icalLines.join('\r\n');
    }
}


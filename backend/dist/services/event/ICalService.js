"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ICalService = void 0;
class ICalService {
    generateICalEvent(event) {
        const now = new Date();
        const dateFormat = (date) => `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
        const escapeLine = (text) => text
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
    generateICalCalendar(events) {
        const now = new Date();
        const dateFormat = (date) => `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
        const escapeLine = (text) => text
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
exports.ICalService = ICalService;
//# sourceMappingURL=ICalService.js.map
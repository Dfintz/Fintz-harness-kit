"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketTemplateService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Ticket_1 = require("../../../models/Ticket");
const logger_1 = require("../../../utils/logger");
const TICKET_TEMPLATES = [
    {
        id: 'recruitment-application',
        name: 'Recruitment Application',
        description: 'Standard template for new member recruitment applications',
        category: Ticket_1.TicketCategory.RECRUITMENT,
        defaultPriority: Ticket_1.TicketPriority.MEDIUM,
        icon: '📋',
        subjectTemplate: 'Recruitment Application: {applicantName}',
        descriptionTemplate: `**New Recruitment Application**

**Applicant:** {applicantName}
**RSI Handle:** {rsiHandle}
**Discord:** {discordHandle}
**Timezone:** {timezone}

**Previous Experience:**
{experience}

**Why do you want to join?**
{motivation}

**Ships Owned:**
{ships}

**Available Hours Per Week:**
{availability}`,
        fields: [
            { name: 'applicantName', label: 'Applicant Name', type: 'text', required: true, placeholder: 'Full name or handle' },
            { name: 'rsiHandle', label: 'RSI Handle', type: 'text', required: true, placeholder: 'Your RSI username' },
            { name: 'discordHandle', label: 'Discord Handle', type: 'text', required: true, placeholder: 'e.g., User#1234' },
            { name: 'timezone', label: 'Timezone', type: 'select', required: true, options: ['NA East', 'NA West', 'EU', 'APAC', 'Other'] },
            { name: 'experience', label: 'Previous Experience', type: 'textarea', required: true, placeholder: 'Describe your gaming experience' },
            { name: 'motivation', label: 'Motivation', type: 'textarea', required: true, placeholder: 'Why do you want to join us?' },
            { name: 'ships', label: 'Ships Owned', type: 'textarea', required: false, placeholder: 'List your ships' },
            { name: 'availability', label: 'Availability', type: 'select', required: true, options: ['1-5 hours', '5-10 hours', '10-20 hours', '20+ hours'] }
        ],
        tags: ['recruitment', 'application', 'new-member'],
        suggestedAssigneeRoles: ['Recruitment Officer', 'HR Lead'],
        estimatedResponseTime: '24-48 hours'
    },
    {
        id: 'diplomacy-inquiry',
        name: 'Diplomacy Inquiry',
        description: 'Template for inter-organization diplomatic communications',
        category: Ticket_1.TicketCategory.DIPLOMACY,
        defaultPriority: Ticket_1.TicketPriority.HIGH,
        icon: '🤝',
        subjectTemplate: 'Diplomacy: {organizationName} - {inquiryType}',
        descriptionTemplate: `**Diplomatic Inquiry**

**From Organization:** {organizationName}
**RSI Organization Link:** {rsiLink}
**Contact Person:** {contactPerson}
**Contact Discord:** {contactDiscord}

**Inquiry Type:** {inquiryType}

**Message:**
{message}

**Proposed Terms/Details:**
{proposedTerms}`,
        fields: [
            { name: 'organizationName', label: 'Organization Name', type: 'text', required: true, placeholder: 'Your organization name' },
            { name: 'rsiLink', label: 'RSI Organization Page', type: 'text', required: true, placeholder: 'https://robertsspaceindustries.com/orgs/...' },
            { name: 'contactPerson', label: 'Contact Person', type: 'text', required: true, placeholder: 'Primary contact' },
            { name: 'contactDiscord', label: 'Contact Discord', type: 'text', required: true, placeholder: 'Discord handle' },
            { name: 'inquiryType', label: 'Inquiry Type', type: 'select', required: true, options: ['Alliance Proposal', 'Trade Agreement', 'Non-Aggression Pact', 'Joint Operation', 'Information Request', 'Conflict Resolution', 'Other'] },
            { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Your diplomatic message' },
            { name: 'proposedTerms', label: 'Proposed Terms', type: 'textarea', required: false, placeholder: 'Any specific terms or proposals' }
        ],
        tags: ['diplomacy', 'alliance', 'external'],
        suggestedAssigneeRoles: ['Diplomat', 'Organization Leader'],
        estimatedResponseTime: '48-72 hours'
    },
    {
        id: 'hr-complaint',
        name: 'HR Complaint',
        description: 'Template for reporting member conduct issues or complaints',
        category: Ticket_1.TicketCategory.HR,
        defaultPriority: Ticket_1.TicketPriority.HIGH,
        icon: '⚠️',
        subjectTemplate: 'HR Complaint: {issueType}',
        descriptionTemplate: `**HR Complaint Report**

**Issue Type:** {issueType}
**Date of Incident:** {incidentDate}
**Reported By:** {reporterName} (Confidential)

**Member(s) Involved:**
{membersInvolved}

**Description of Incident:**
{description}

**Evidence/Screenshots:**
{evidence}

**Desired Resolution:**
{resolution}

*This report will be handled confidentially.*`,
        fields: [
            { name: 'issueType', label: 'Issue Type', type: 'select', required: true, options: ['Code of Conduct Violation', 'Harassment', 'Discrimination', 'Insubordination', 'Conflict Between Members', 'Other'] },
            { name: 'incidentDate', label: 'Date of Incident', type: 'date', required: true },
            { name: 'reporterName', label: 'Your Name', type: 'text', required: true, placeholder: 'Your name (kept confidential)' },
            { name: 'membersInvolved', label: 'Members Involved', type: 'textarea', required: true, placeholder: 'List all members involved' },
            { name: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Describe what happened in detail' },
            { name: 'evidence', label: 'Evidence', type: 'textarea', required: false, placeholder: 'Links to screenshots or other evidence' },
            { name: 'resolution', label: 'Desired Resolution', type: 'textarea', required: false, placeholder: 'What outcome are you hoping for?' }
        ],
        tags: ['hr', 'complaint', 'confidential'],
        suggestedAssigneeRoles: ['HR Manager', 'Organization Leader'],
        estimatedResponseTime: '24 hours'
    },
    {
        id: 'general-support',
        name: 'General Support Request',
        description: 'General purpose support ticket for various inquiries',
        category: Ticket_1.TicketCategory.SUPPORT,
        defaultPriority: Ticket_1.TicketPriority.MEDIUM,
        icon: '❓',
        subjectTemplate: 'Support Request: {topic}',
        descriptionTemplate: `**Support Request**

**Topic:** {topic}
**Requested By:** {requesterName}

**Description:**
{description}

**Additional Information:**
{additionalInfo}`,
        fields: [
            { name: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'Brief topic of your request' },
            { name: 'requesterName', label: 'Your Name', type: 'text', required: true, placeholder: 'Your name or handle' },
            { name: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Describe your request or issue' },
            { name: 'additionalInfo', label: 'Additional Information', type: 'textarea', required: false, placeholder: 'Any other relevant information' }
        ],
        tags: ['support', 'general', 'inquiry'],
        suggestedAssigneeRoles: ['Support Staff'],
        estimatedResponseTime: '24-48 hours'
    },
    {
        id: 'ship-dispute',
        name: 'Ship/Asset Dispute',
        description: 'Template for reporting disputes over ships or organization assets',
        category: Ticket_1.TicketCategory.GENERAL,
        defaultPriority: Ticket_1.TicketPriority.MEDIUM,
        icon: '🚀',
        subjectTemplate: 'Asset Dispute: {assetName}',
        descriptionTemplate: `**Asset Dispute Report**

**Asset Type:** {assetType}
**Asset Name/ID:** {assetName}
**Claimed By:** {claimedBy}
**Disputed By:** {disputedBy}

**Dispute Description:**
{description}

**Supporting Evidence:**
{evidence}

**Preferred Resolution:**
{resolution}`,
        fields: [
            { name: 'assetType', label: 'Asset Type', type: 'select', required: true, options: ['Ship', 'Vehicle', 'Hangar Item', 'Organization Asset', 'Other'] },
            { name: 'assetName', label: 'Asset Name/ID', type: 'text', required: true, placeholder: 'Name or identifier of the asset' },
            { name: 'claimedBy', label: 'Claimed By', type: 'text', required: true, placeholder: 'Who currently claims ownership?' },
            { name: 'disputedBy', label: 'Disputed By', type: 'text', required: true, placeholder: 'Who is disputing the claim?' },
            { name: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Explain the dispute' },
            { name: 'evidence', label: 'Evidence', type: 'textarea', required: false, placeholder: 'Links or descriptions of evidence' },
            { name: 'resolution', label: 'Preferred Resolution', type: 'textarea', required: false, placeholder: 'What resolution would you prefer?' }
        ],
        tags: ['dispute', 'asset', 'ship'],
        suggestedAssigneeRoles: ['HR Manager', 'Asset Manager'],
        estimatedResponseTime: '48 hours'
    },
    {
        id: 'leave-of-absence',
        name: 'Leave of Absence Request',
        description: 'Template for requesting extended leave from organization activities',
        category: Ticket_1.TicketCategory.HR,
        defaultPriority: Ticket_1.TicketPriority.LOW,
        icon: '🏖️',
        subjectTemplate: 'Leave of Absence: {memberName}',
        descriptionTemplate: `**Leave of Absence Request**

**Member:** {memberName}
**Current Role:** {currentRole}

**Leave Duration:**
- Start Date: {startDate}
- Expected Return: {returnDate}

**Reason for Leave:**
{reason}

**Handover Notes:**
{handoverNotes}

**Contact During Leave:**
{contactInfo}`,
        fields: [
            { name: 'memberName', label: 'Your Name', type: 'text', required: true, placeholder: 'Your name or handle' },
            { name: 'currentRole', label: 'Current Role', type: 'text', required: true, placeholder: 'Your role in the organization' },
            { name: 'startDate', label: 'Start Date', type: 'date', required: true },
            { name: 'returnDate', label: 'Expected Return Date', type: 'date', required: true },
            { name: 'reason', label: 'Reason', type: 'select', required: true, options: ['Personal', 'Work/School', 'Health', 'Vacation', 'Other'] },
            { name: 'handoverNotes', label: 'Handover Notes', type: 'textarea', required: false, placeholder: 'Any tasks that need coverage' },
            { name: 'contactInfo', label: 'Contact During Leave', type: 'text', required: false, placeholder: 'How can we reach you if urgent?' }
        ],
        tags: ['hr', 'leave', 'absence'],
        suggestedAssigneeRoles: ['HR Manager'],
        estimatedResponseTime: '24 hours'
    },
    {
        id: 'bug-report',
        name: 'Platform Bug Report',
        description: 'Template for reporting bugs or issues with the fleet manager platform',
        category: Ticket_1.TicketCategory.SUPPORT,
        defaultPriority: Ticket_1.TicketPriority.MEDIUM,
        icon: '🐛',
        subjectTemplate: 'Bug Report: {bugTitle}',
        descriptionTemplate: `**Bug Report**

**Title:** {bugTitle}
**Severity:** {severity}
**Reported By:** {reporterName}

**Steps to Reproduce:**
{stepsToReproduce}

**Expected Behavior:**
{expectedBehavior}

**Actual Behavior:**
{actualBehavior}

**Browser/Environment:**
{environment}

**Screenshots/Evidence:**
{screenshots}`,
        fields: [
            { name: 'bugTitle', label: 'Bug Title', type: 'text', required: true, placeholder: 'Brief description of the bug' },
            { name: 'severity', label: 'Severity', type: 'select', required: true, options: ['Critical', 'High', 'Medium', 'Low'] },
            { name: 'reporterName', label: 'Your Name', type: 'text', required: true, placeholder: 'Your name or handle' },
            { name: 'stepsToReproduce', label: 'Steps to Reproduce', type: 'textarea', required: true, placeholder: '1. Go to...\n2. Click on...\n3. See error...' },
            { name: 'expectedBehavior', label: 'Expected Behavior', type: 'textarea', required: true, placeholder: 'What should have happened?' },
            { name: 'actualBehavior', label: 'Actual Behavior', type: 'textarea', required: true, placeholder: 'What actually happened?' },
            { name: 'environment', label: 'Browser/Environment', type: 'text', required: true, placeholder: 'Chrome, Firefox, Edge, etc.' },
            { name: 'screenshots', label: 'Screenshots', type: 'textarea', required: false, placeholder: 'Links to screenshots or error messages' }
        ],
        tags: ['support', 'bug', 'technical'],
        suggestedAssigneeRoles: ['Technical Support', 'Developer'],
        estimatedResponseTime: '24-72 hours'
    },
    {
        id: 'feature-request',
        name: 'Feature Request',
        description: 'Template for requesting new features or improvements',
        category: Ticket_1.TicketCategory.SUPPORT,
        defaultPriority: Ticket_1.TicketPriority.LOW,
        icon: '💡',
        subjectTemplate: 'Feature Request: {featureTitle}',
        descriptionTemplate: `**Feature Request**

**Title:** {featureTitle}
**Requested By:** {requesterName}

**Feature Description:**
{description}

**Use Case:**
{useCase}

**Expected Benefits:**
{benefits}

**Priority:**
{priorityLevel}`,
        fields: [
            { name: 'featureTitle', label: 'Feature Title', type: 'text', required: true, placeholder: 'Brief title for the feature' },
            { name: 'requesterName', label: 'Your Name', type: 'text', required: true, placeholder: 'Your name or handle' },
            { name: 'description', label: 'Feature Description', type: 'textarea', required: true, placeholder: 'Describe the feature in detail' },
            { name: 'useCase', label: 'Use Case', type: 'textarea', required: true, placeholder: 'How would you use this feature?' },
            { name: 'benefits', label: 'Expected Benefits', type: 'textarea', required: false, placeholder: 'How would this help the organization?' },
            { name: 'priorityLevel', label: 'Priority Level', type: 'select', required: true, options: ['Nice to Have', 'Would Be Helpful', 'Important', 'Critical Need'] }
        ],
        tags: ['support', 'feature-request', 'improvement'],
        suggestedAssigneeRoles: ['Product Manager', 'Developer'],
        estimatedResponseTime: '1-2 weeks'
    }
];
const customTemplates = new Map();
class TicketTemplateService {
    static instance;
    constructor() {
        logger_1.logger.info('TicketTemplateService initialized');
    }
    static getInstance() {
        if (!TicketTemplateService.instance) {
            TicketTemplateService.instance = new TicketTemplateService();
        }
        return TicketTemplateService.instance;
    }
    getTemplates() {
        return [...TICKET_TEMPLATES, ...Array.from(customTemplates.values())];
    }
    getBuiltInTemplates() {
        return [...TICKET_TEMPLATES];
    }
    getCustomTemplates() {
        return Array.from(customTemplates.values());
    }
    getTemplatesByCategory(category) {
        return this.getTemplates().filter(t => t.category === category);
    }
    getTemplate(templateId) {
        const builtIn = TICKET_TEMPLATES.find(t => t.id === templateId);
        if (builtIn) {
            return builtIn;
        }
        return customTemplates.get(templateId);
    }
    searchTemplates(query) {
        const lowerQuery = query.toLowerCase();
        return this.getTemplates().filter(t => t.name.toLowerCase().includes(lowerQuery) ||
            t.description.toLowerCase().includes(lowerQuery) ||
            t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));
    }
    createFromTemplate(options) {
        const template = this.getTemplate(options.templateId);
        if (!template) {
            throw new Error(`Template not found: ${options.templateId}`);
        }
        for (const field of template.fields) {
            if (field.required && !options.fieldValues[field.name]) {
                throw new Error(`Required field missing: ${field.label}`);
            }
        }
        let subject = template.subjectTemplate;
        for (const [key, value] of Object.entries(options.fieldValues)) {
            subject = subject.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        let description = template.descriptionTemplate;
        for (const [key, value] of Object.entries(options.fieldValues)) {
            description = description.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        const tags = [
            ...template.tags,
            ...(options.additionalTags || [])
        ];
        const ticketData = {
            subject,
            description,
            category: template.category,
            priority: options.overridePriority || template.defaultPriority,
            tags,
            templateId: template.id,
            templateName: template.name,
            customFields: options.fieldValues
        };
        logger_1.logger.info('Ticket data created from template', {
            templateId: template.id,
            templateName: template.name,
            creatorId: options.creatorId
        });
        return ticketData;
    }
    createCustomTemplate(organizationId, template) {
        const templateId = `custom-${organizationId}-${crypto_1.default.randomUUID()}`;
        const customTemplate = {
            ...template,
            id: templateId
        };
        customTemplates.set(templateId, customTemplate);
        logger_1.logger.info('Custom ticket template created', {
            templateId,
            templateName: template.name,
            organizationId
        });
        return customTemplate;
    }
    updateCustomTemplate(templateId, updates) {
        const existing = customTemplates.get(templateId);
        if (!existing) {
            throw new Error(`Custom template not found: ${templateId}`);
        }
        if (TICKET_TEMPLATES.some(t => t.id === templateId)) {
            throw new Error('Cannot modify built-in templates');
        }
        const updated = {
            ...existing,
            ...updates,
            id: templateId
        };
        customTemplates.set(templateId, updated);
        logger_1.logger.info('Custom ticket template updated', { templateId });
        return updated;
    }
    deleteCustomTemplate(templateId) {
        if (TICKET_TEMPLATES.some(t => t.id === templateId)) {
            throw new Error('Cannot delete built-in templates');
        }
        const deleted = customTemplates.delete(templateId);
        if (deleted) {
            logger_1.logger.info('Custom ticket template deleted', { templateId });
        }
        return deleted;
    }
    cloneTemplate(sourceTemplateId, organizationId, newName) {
        const source = this.getTemplate(sourceTemplateId);
        if (!source) {
            throw new Error(`Source template not found: ${sourceTemplateId}`);
        }
        const cloned = this.createCustomTemplate(organizationId, {
            ...source,
            name: newName || `${source.name} (Copy)`
        });
        logger_1.logger.info('Template cloned', {
            sourceTemplateId,
            newTemplateId: cloned.id,
            organizationId
        });
        return cloned;
    }
    recommendTemplates(needs) {
        let recommendations = [...this.getTemplates()];
        if (needs.category) {
            recommendations = recommendations.filter(t => t.category === needs.category);
        }
        if (needs.keyword) {
            const lowerKeyword = needs.keyword.toLowerCase();
            recommendations = recommendations.filter(t => t.name.toLowerCase().includes(lowerKeyword) ||
                t.description.toLowerCase().includes(lowerKeyword));
        }
        if (needs.tags && needs.tags.length > 0) {
            const needsTags = needs.tags;
            recommendations = recommendations.sort((a, b) => {
                const aMatches = a.tags.filter(tag => needsTags.some(nt => tag.toLowerCase().includes(nt.toLowerCase()))).length;
                const bMatches = b.tags.filter(tag => needsTags.some(nt => tag.toLowerCase().includes(nt.toLowerCase()))).length;
                return bMatches - aMatches;
            });
        }
        return recommendations.slice(0, 5);
    }
    getCategoryCounts() {
        const counts = {
            [Ticket_1.TicketCategory.HR]: 0,
            [Ticket_1.TicketCategory.RECRUITMENT]: 0,
            [Ticket_1.TicketCategory.DIPLOMACY]: 0,
            [Ticket_1.TicketCategory.GENERAL]: 0,
            [Ticket_1.TicketCategory.SUPPORT]: 0
        };
        for (const template of this.getTemplates()) {
            counts[template.category]++;
        }
        return counts;
    }
    getStats() {
        return {
            totalTemplates: this.getTemplates().length,
            builtInTemplates: TICKET_TEMPLATES.length,
            customTemplates: customTemplates.size,
            categoryCounts: this.getCategoryCounts()
        };
    }
    validateFieldValues(templateId, fieldValues) {
        const template = this.getTemplate(templateId);
        if (!template) {
            return { valid: false, errors: [`Template not found: ${templateId}`] };
        }
        const errors = [];
        for (const field of template.fields) {
            const value = fieldValues[field.name];
            if (field.required && (!value || value.trim() === '')) {
                errors.push(`Required field missing: ${field.label}`);
            }
            if (value && field.type === 'select' && field.options) {
                if (!field.options.includes(value)) {
                    errors.push(`Invalid option for ${field.label}: ${value}`);
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }
    clearCustomTemplates() {
        customTemplates.clear();
        logger_1.logger.info('All custom ticket templates cleared');
    }
}
exports.TicketTemplateService = TicketTemplateService;
//# sourceMappingURL=TicketTemplateService.js.map
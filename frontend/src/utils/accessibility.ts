/**
 * Accessibility Testing Utilities
 * 
 * WCAG 2.1 AA compliance helpers for automated accessibility auditing.
 * Issue: UX - Accessibility audit / WCAG 2.1 AA compliance check
 */

/**
 * WCAG 2.1 AA Color Contrast Requirements
 * - Normal text: 4.5:1
 * - Large text (18pt or 14pt bold): 3:1
 * - UI components: 3:1
 */
export const WCAG_CONTRAST_RATIOS = {
    NORMAL_TEXT: 4.5,
    LARGE_TEXT: 3,
    UI_COMPONENTS: 3
};

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 formula
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        const sRGB = c / 255;
        return sRGB <= 0.03928
            ? sRGB / 12.92
            : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(
    color1: { r: number; g: number; b: number },
    color2: { r: number; g: number; b: number }
): number {
    const l1 = getRelativeLuminance(color1.r, color1.g, color1.b);
    const l2 = getRelativeLuminance(color2.r, color2.g, color2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Check if contrast ratio meets WCAG AA requirements
 */
export function meetsWCAGAA(
    foreground: string,
    background: string,
    isLargeText: boolean = false
): { passes: boolean; ratio: number; required: number } {
    const fg = hexToRgb(foreground);
    const bg = hexToRgb(background);
    
    if (!fg || !bg) {
        return { passes: false, ratio: 0, required: 0 };
    }
    
    const ratio = getContrastRatio(fg, bg);
    const required = isLargeText ? WCAG_CONTRAST_RATIOS.LARGE_TEXT : WCAG_CONTRAST_RATIOS.NORMAL_TEXT;
    
    return {
        passes: ratio >= required,
        ratio: Math.round(ratio * 100) / 100,
        required
    };
}

/**
 * Accessibility issue types
 */
export enum A11yIssueType {
    MISSING_ALT = 'missing-alt',
    MISSING_LABEL = 'missing-label',
    LOW_CONTRAST = 'low-contrast',
    MISSING_FOCUS = 'missing-focus',
    NO_KEYBOARD_ACCESS = 'no-keyboard-access',
    MISSING_ARIA = 'missing-aria',
    INVALID_HEADING = 'invalid-heading',
    MISSING_LANG = 'missing-lang',
    AUTOPLAYING_MEDIA = 'autoplaying-media',
    MISSING_SKIP_LINK = 'missing-skip-link'
}

/**
 * Accessibility issue severity
 */
export enum A11ySeverity {
    CRITICAL = 'critical',
    SERIOUS = 'serious',
    MODERATE = 'moderate',
    MINOR = 'minor'
}

/**
 * Accessibility audit result
 */
export interface A11yIssue {
    type: A11yIssueType;
    severity: A11ySeverity;
    element?: string;
    description: string;
    wcagCriteria: string;
    suggestion: string;
}

/**
 * Run a basic accessibility audit on the current document
 * Note: For comprehensive audits, use axe-core or similar libraries
 */
export function runBasicA11yAudit(): A11yIssue[] {
    const issues: A11yIssue[] = [];
    
    // Check for missing alt text on images
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
        if (!img.alt) {
            issues.push({
                type: A11yIssueType.MISSING_ALT,
                severity: A11ySeverity.CRITICAL,
                element: `img[${index}]`,
                description: 'Image is missing alt text',
                wcagCriteria: '1.1.1 Non-text Content',
                suggestion: 'Add descriptive alt text or empty alt="" for decorative images'
            });
        }
    });
    
    // Check for missing form labels
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach((input, index) => {
        const id = input.id;
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        
        if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
            issues.push({
                type: A11yIssueType.MISSING_LABEL,
                severity: A11ySeverity.CRITICAL,
                element: `${input.tagName.toLowerCase()}[${index}]`,
                description: 'Form field is missing a label',
                wcagCriteria: '1.3.1 Info and Relationships, 4.1.2 Name, Role, Value',
                suggestion: 'Add a <label> element or aria-label attribute'
            });
        }
    });
    
    // Check for proper heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    headings.forEach((heading) => {
        const level = parseInt(heading.tagName[1]);
        if (previousLevel > 0 && level > previousLevel + 1) {
            issues.push({
                type: A11yIssueType.INVALID_HEADING,
                severity: A11ySeverity.MODERATE,
                element: heading.tagName,
                description: `Heading level skipped from h${previousLevel} to h${level}`,
                wcagCriteria: '1.3.1 Info and Relationships',
                suggestion: 'Ensure heading levels are sequential without skipping'
            });
        }
        previousLevel = level;
    });
    
    // Check for missing lang attribute
    if (!document.documentElement.lang) {
        issues.push({
            type: A11yIssueType.MISSING_LANG,
            severity: A11ySeverity.SERIOUS,
            element: 'html',
            description: 'Document is missing lang attribute',
            wcagCriteria: '3.1.1 Language of Page',
            suggestion: 'Add lang attribute to <html> element (e.g., lang="en")'
        });
    }
    
    // Check for buttons without accessible names
    const buttons = document.querySelectorAll('button');
    buttons.forEach((button, index) => {
        const text = button.textContent?.trim();
        const ariaLabel = button.getAttribute('aria-label');
        const ariaLabelledBy = button.getAttribute('aria-labelledby');
        
        if (!text && !ariaLabel && !ariaLabelledBy) {
            issues.push({
                type: A11yIssueType.MISSING_ARIA,
                severity: A11ySeverity.CRITICAL,
                element: `button[${index}]`,
                description: 'Button is missing accessible name',
                wcagCriteria: '4.1.2 Name, Role, Value',
                suggestion: 'Add text content, aria-label, or aria-labelledby'
            });
        }
    });
    
    // Check for links without href or with empty href
    const links = document.querySelectorAll('a');
    links.forEach((link, index) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') {
            const hasOnClick = link.onclick !== null || link.getAttribute('onclick');
            if (hasOnClick) {
                issues.push({
                    type: A11yIssueType.NO_KEYBOARD_ACCESS,
                    severity: A11ySeverity.SERIOUS,
                    element: `a[${index}]`,
                    description: 'Link with JavaScript action may not be keyboard accessible',
                    wcagCriteria: '2.1.1 Keyboard',
                    suggestion: 'Use <button> for actions or ensure keyboard handlers work'
                });
            }
        }
    });
    
    // Check for autoplaying video/audio
    const media = document.querySelectorAll('video, audio');
    media.forEach((element, index) => {
        if (element.hasAttribute('autoplay')) {
            issues.push({
                type: A11yIssueType.AUTOPLAYING_MEDIA,
                severity: A11ySeverity.SERIOUS,
                element: `${element.tagName.toLowerCase()}[${index}]`,
                description: 'Media element autoplays which can be disorienting',
                wcagCriteria: '1.4.2 Audio Control',
                suggestion: 'Remove autoplay or provide pause controls within 3 seconds'
            });
        }
    });
    
    return issues;
}

/**
 * Generate an accessibility report
 */
export function generateA11yReport(issues: A11yIssue[]): string {
    const critical = issues.filter(i => i.severity === A11ySeverity.CRITICAL);
    const serious = issues.filter(i => i.severity === A11ySeverity.SERIOUS);
    const moderate = issues.filter(i => i.severity === A11ySeverity.MODERATE);
    const minor = issues.filter(i => i.severity === A11ySeverity.MINOR);
    
    let report = `# Accessibility Audit Report\n\n`;
    report += `## Summary\n`;
    report += `- Critical Issues: ${critical.length}\n`;
    report += `- Serious Issues: ${serious.length}\n`;
    report += `- Moderate Issues: ${moderate.length}\n`;
    report += `- Minor Issues: ${minor.length}\n`;
    report += `- Total Issues: ${issues.length}\n\n`;
    
    if (critical.length > 0) {
        report += `## Critical Issues\n`;
        critical.forEach(issue => {
            report += formatIssue(issue);
        });
    }
    
    if (serious.length > 0) {
        report += `## Serious Issues\n`;
        serious.forEach(issue => {
            report += formatIssue(issue);
        });
    }
    
    if (moderate.length > 0) {
        report += `## Moderate Issues\n`;
        moderate.forEach(issue => {
            report += formatIssue(issue);
        });
    }
    
    if (minor.length > 0) {
        report += `## Minor Issues\n`;
        minor.forEach(issue => {
            report += formatIssue(issue);
        });
    }
    
    return report;
}

function formatIssue(issue: A11yIssue): string {
    return `
### ${issue.type}
- **Element**: ${issue.element || 'N/A'}
- **Description**: ${issue.description}
- **WCAG Criteria**: ${issue.wcagCriteria}
- **Suggestion**: ${issue.suggestion}

`;
}

/**
 * ARIA roles reference for correct usage
 */
export const ARIA_ROLES = {
    LANDMARK: ['banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search'],
    WIDGET: ['alert', 'alertdialog', 'button', 'checkbox', 'dialog', 'gridcell', 'link', 'log', 'marquee', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'progressbar', 'radio', 'scrollbar', 'searchbox', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'tabpanel', 'textbox', 'timer', 'tooltip', 'treeitem'],
    DOCUMENT: ['article', 'cell', 'columnheader', 'definition', 'directory', 'document', 'feed', 'figure', 'group', 'heading', 'img', 'list', 'listitem', 'math', 'note', 'presentation', 'row', 'rowgroup', 'rowheader', 'separator', 'table', 'term', 'toolbar']
};

/**
 * Check if an element has valid focus styles
 * Note: This uses a programmatic approach since getComputedStyle doesn't support pseudo-elements
 */
export function checkFocusStyles(element: HTMLElement): boolean {
    // Get the current styles
    const beforeFocus = window.getComputedStyle(element);
    const beforeOutline = beforeFocus.outlineStyle;
    const beforeOutlineWidth = beforeFocus.outlineWidth;
    const beforeBoxShadow = beforeFocus.boxShadow;
    
    // Trigger focus
    element.focus();
    
    // Get styles after focus
    const afterFocus = window.getComputedStyle(element);
    const afterOutline = afterFocus.outlineStyle;
    const afterOutlineWidth = afterFocus.outlineWidth;
    const afterBoxShadow = afterFocus.boxShadow;
    
    // Blur the element
    element.blur();
    
    // Check for visible focus indicator changes
    const outlineChanged = beforeOutline !== afterOutline || beforeOutlineWidth !== afterOutlineWidth;
    const boxShadowChanged = beforeBoxShadow !== afterBoxShadow;
    const hasVisibleOutline = afterOutline !== 'none' && parseFloat(afterOutlineWidth) > 0;
    const hasVisibleBoxShadow = afterBoxShadow !== 'none' && afterBoxShadow !== beforeBoxShadow;
    
    return (outlineChanged && hasVisibleOutline) || (boxShadowChanged && hasVisibleBoxShadow);
}

export const Accessibility = {
    WCAG_CONTRAST_RATIOS,
    getRelativeLuminance,
    getContrastRatio,
    hexToRgb,
    meetsWCAGAA,
    runBasicA11yAudit,
    generateA11yReport,
    checkFocusStyles,
    ARIA_ROLES,
    A11yIssueType,
    A11ySeverity
};

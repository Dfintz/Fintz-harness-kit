/**
 * Accessibility Utility Tests
 * Tests for WCAG 2.1 AA compliance helpers
 */

import {
    WCAG_CONTRAST_RATIOS,
    getRelativeLuminance,
    getContrastRatio,
    hexToRgb,
    meetsWCAGAA,
    A11yIssueType,
    A11ySeverity
} from '@/utils/accessibility';

describe('WCAG Contrast Ratios', () => {
    it('should have correct contrast ratio constants', () => {
        expect(WCAG_CONTRAST_RATIOS.NORMAL_TEXT).toBe(4.5);
        expect(WCAG_CONTRAST_RATIOS.LARGE_TEXT).toBe(3);
        expect(WCAG_CONTRAST_RATIOS.UI_COMPONENTS).toBe(3);
    });
});

describe('getRelativeLuminance', () => {
    it('should return 0 for black', () => {
        const luminance = getRelativeLuminance(0, 0, 0);
        expect(luminance).toBe(0);
    });

    it('should return 1 for white', () => {
        const luminance = getRelativeLuminance(255, 255, 255);
        expect(luminance).toBe(1);
    });

    it('should return correct luminance for primary colors', () => {
        // Red
        const redLuminance = getRelativeLuminance(255, 0, 0);
        expect(redLuminance).toBeCloseTo(0.2126, 4);

        // Green
        const greenLuminance = getRelativeLuminance(0, 255, 0);
        expect(greenLuminance).toBeCloseTo(0.7152, 4);

        // Blue
        const blueLuminance = getRelativeLuminance(0, 0, 255);
        expect(blueLuminance).toBeCloseTo(0.0722, 4);
    });

    it('should handle mid-range colors correctly', () => {
        // Gray (128, 128, 128)
        const grayLuminance = getRelativeLuminance(128, 128, 128);
        expect(grayLuminance).toBeGreaterThan(0);
        expect(grayLuminance).toBeLessThan(1);
    });
});

describe('getContrastRatio', () => {
    it('should return 21:1 for black on white', () => {
        const ratio = getContrastRatio(
            { r: 0, g: 0, b: 0 },
            { r: 255, g: 255, b: 255 }
        );
        expect(ratio).toBeCloseTo(21, 0);
    });

    it('should return 1:1 for same colors', () => {
        const ratio = getContrastRatio(
            { r: 128, g: 128, b: 128 },
            { r: 128, g: 128, b: 128 }
        );
        expect(ratio).toBe(1);
    });

    it('should be symmetric - order should not matter', () => {
        const ratio1 = getContrastRatio(
            { r: 0, g: 0, b: 0 },
            { r: 255, g: 255, b: 255 }
        );
        const ratio2 = getContrastRatio(
            { r: 255, g: 255, b: 255 },
            { r: 0, g: 0, b: 0 }
        );
        expect(ratio1).toBe(ratio2);
    });

    it('should calculate low contrast correctly', () => {
        // Light gray on white
        const ratio = getContrastRatio(
            { r: 200, g: 200, b: 200 },
            { r: 255, g: 255, b: 255 }
        );
        expect(ratio).toBeLessThan(3);
    });
});

describe('hexToRgb', () => {
    it('should parse hex colors with hash', () => {
        expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
        expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
        expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
        expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
        expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should parse hex colors without hash', () => {
        expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 });
        expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('should handle uppercase and lowercase', () => {
        expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
        expect(hexToRgb('#AbCdEf')).toEqual({ r: 171, g: 205, b: 239 });
    });

    it('should return null for invalid hex', () => {
        expect(hexToRgb('#fff')).toBeNull(); // Too short
        expect(hexToRgb('#gggggg')).toBeNull(); // Invalid characters
        expect(hexToRgb('invalid')).toBeNull();
        expect(hexToRgb('')).toBeNull();
    });
});

describe('meetsWCAGAA', () => {
    describe('normal text', () => {
        it('should pass for black on white (high contrast)', () => {
            const result = meetsWCAGAA('#000000', '#ffffff', false);
            expect(result.passes).toBe(true);
            expect(result.ratio).toBeCloseTo(21, 0);
            expect(result.required).toBe(4.5);
        });

        it('should fail for light gray on white (low contrast)', () => {
            const result = meetsWCAGAA('#cccccc', '#ffffff', false);
            expect(result.passes).toBe(false);
            expect(result.required).toBe(4.5);
        });

        it('should pass for accessible color combinations', () => {
            // Dark blue on white
            const result = meetsWCAGAA('#000080', '#ffffff', false);
            expect(result.passes).toBe(true);
        });
    });

    describe('large text', () => {
        it('should have lower contrast requirement', () => {
            const result = meetsWCAGAA('#000000', '#ffffff', true);
            expect(result.required).toBe(3);
        });

        it('should pass for combinations that would fail for normal text', () => {
            // This might pass for large text but not normal
            const normalResult = meetsWCAGAA('#767676', '#ffffff', false);
            const largeResult = meetsWCAGAA('#767676', '#ffffff', true);
            
            // 4.54:1 ratio - passes both for WCAG AA
            expect(normalResult.ratio).toBeGreaterThan(4.5);
            expect(largeResult.ratio).toBeGreaterThan(3);
        });
    });

    describe('invalid colors', () => {
        it('should return failure for invalid foreground', () => {
            const result = meetsWCAGAA('invalid', '#ffffff', false);
            expect(result.passes).toBe(false);
            expect(result.ratio).toBe(0);
        });

        it('should return failure for invalid background', () => {
            const result = meetsWCAGAA('#000000', 'invalid', false);
            expect(result.passes).toBe(false);
            expect(result.ratio).toBe(0);
        });
    });
});

describe('A11yIssueType enum', () => {
    it('should have all expected issue types', () => {
        expect(A11yIssueType.MISSING_ALT).toBe('missing-alt');
        expect(A11yIssueType.MISSING_LABEL).toBe('missing-label');
        expect(A11yIssueType.LOW_CONTRAST).toBe('low-contrast');
        expect(A11yIssueType.MISSING_FOCUS).toBe('missing-focus');
        expect(A11yIssueType.NO_KEYBOARD_ACCESS).toBe('no-keyboard-access');
        expect(A11yIssueType.MISSING_ARIA).toBe('missing-aria');
        expect(A11yIssueType.INVALID_HEADING).toBe('invalid-heading');
        expect(A11yIssueType.MISSING_LANG).toBe('missing-lang');
        expect(A11yIssueType.AUTOPLAYING_MEDIA).toBe('autoplaying-media');
        expect(A11yIssueType.MISSING_SKIP_LINK).toBe('missing-skip-link');
    });
});

describe('A11ySeverity enum', () => {
    it('should have all expected severity levels', () => {
        expect(A11ySeverity.CRITICAL).toBe('critical');
        expect(A11ySeverity.SERIOUS).toBe('serious');
        expect(A11ySeverity.MODERATE).toBe('moderate');
        expect(A11ySeverity.MINOR).toBe('minor');
    });
});

/**
 * Device Fingerprint Utility
 * 
 * Collects browser and device characteristics for Zero Trust security.
 * This fingerprint helps identify and verify trusted devices across sessions.
 * 
 * Privacy Considerations:
 * - Only collects technical browser/device data
 * - No personally identifiable information
 * - Data is hashed server-side before storage
 * - User can revoke trusted devices at any time
 * 
 * Security Features:
 * - Canvas fingerprinting for unique device identification
 * - WebGL renderer detection
 * - Hardware characteristics collection
 * - Timezone and locale information
 */

/**
 * Device fingerprint data structure
 * Matches the backend DeviceFingerprintData interface
 */
export interface DeviceFingerprintData {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
    colorDepth?: number;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    touchSupport?: boolean;
    webglRenderer?: string;
    canvasFingerprint?: string;
}

/**
 * Fingerprint collection options
 */
export interface FingerprintOptions {
    /** Include canvas fingerprinting (default: true) */
    includeCanvas?: boolean;
    /** Include WebGL info (default: true) */
    includeWebGL?: boolean;
    /** Include hardware info (default: true) */
    includeHardware?: boolean;
}

const DEFAULT_OPTIONS: FingerprintOptions = {
    includeCanvas: true,
    includeWebGL: true,
    includeHardware: true
};

/**
 * Get canvas fingerprint
 * Creates a unique hash based on how the browser renders canvas elements
 */
function getCanvasFingerprint(): string | undefined {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            return undefined;
        }

        // Draw text with specific styles
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('SC Fleet Manager', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('SC Fleet Manager', 4, 17);

        // Get data URL as fingerprint
        const dataUrl = canvas.toDataURL();
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < dataUrl.length; i++) {
            const char = dataUrl.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(16);
    } catch {
        return undefined;
    }
}

/**
 * Get WebGL renderer information
 */
function getWebGLRenderer(): string | undefined {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            return undefined;
        }

        const glContext = gl as WebGLRenderingContext;
        const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
        
        if (debugInfo) {
            const renderer = glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            return renderer || undefined;
        }
        
        return undefined;
    } catch {
        return undefined;
    }
}

/**
 * Get screen resolution string
 */
function getScreenResolution(): string {
    return `${window.screen.width}x${window.screen.height}`;
}

/**
 * Get timezone offset string
 */
function getTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return `UTC${new Date().getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(new Date().getTimezoneOffset() / 60)}`;
    }
}

/**
 * Check if device has touch support
 */
function hasTouchSupport(): boolean {
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0
    );
}

/**
 * Collect device fingerprint data
 * 
 * @param options - Collection options
 * @returns Device fingerprint data
 */
export function collectFingerprint(options: FingerprintOptions = {}): DeviceFingerprintData {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    const fingerprint: DeviceFingerprintData = {
        userAgent: navigator.userAgent,
        screenResolution: getScreenResolution(),
        timezone: getTimezone(),
        language: navigator.language,
        platform: navigator.platform
    };

    // Hardware characteristics
    if (opts.includeHardware) {
        fingerprint.colorDepth = window.screen.colorDepth;
        fingerprint.hardwareConcurrency = navigator.hardwareConcurrency;
        // Use proper type for deviceMemory (non-standard API)
        fingerprint.deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
        fingerprint.touchSupport = hasTouchSupport();
    }

    // WebGL renderer
    if (opts.includeWebGL) {
        fingerprint.webglRenderer = getWebGLRenderer();
    }

    // Canvas fingerprint
    if (opts.includeCanvas) {
        fingerprint.canvasFingerprint = getCanvasFingerprint();
    }

    return fingerprint;
}

/**
 * Alias for collectFingerprint for backward compatibility
 * @deprecated Use collectFingerprint instead
 */
export const collectDeviceFingerprint = collectFingerprint;

/**
 * Create a simple hash of the fingerprint for client-side caching
 * Note: Server-side hashing is used for actual storage
 */
export async function hashFingerprint(fingerprint: DeviceFingerprintData): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(fingerprint));
    
    // Use Web Crypto API for hashing
    if (crypto?.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback for environments without Web Crypto
    let hash = 0;
    const str = JSON.stringify(fingerprint);
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

/**
 * Get fingerprint header for API requests
 * Returns the fingerprint as a string suitable for the X-Device-Fingerprint header
 */
export async function getFingerprintHeader(): Promise<string> {
    const fingerprint = collectFingerprint();
    return await hashFingerprint(fingerprint);
}

/**
 * Device fingerprint service class for managing fingerprint operations
 */
export class DeviceFingerprintService {
    private cachedFingerprint: DeviceFingerprintData | null = null;
    private cachedHash: string | null = null;

    /**
     * Get the device fingerprint, using cache if available
     */
    getFingerprint(): DeviceFingerprintData {
        if (!this.cachedFingerprint) {
            this.cachedFingerprint = collectFingerprint();
        }
        return this.cachedFingerprint;
    }

    /**
     * Get the fingerprint hash for API requests
     */
    async getHash(): Promise<string> {
        if (!this.cachedHash) {
            this.cachedHash = await hashFingerprint(this.getFingerprint());
        }
        return this.cachedHash;
    }

    /**
     * Get headers to include in authenticated API requests
     */
    async getHeaders(): Promise<Record<string, string>> {
        const hash = await this.getHash();
        return {
            'X-Device-Fingerprint': hash
        };
    }

    /**
     * Clear cached fingerprint (useful when device info changes)
     */
    clearCache(): void {
        this.cachedFingerprint = null;
        this.cachedHash = null;
    }

    /**
     * Check if this appears to be the same device as a given hash
     */
    async matches(storedHash: string): Promise<boolean> {
        const currentHash = await this.getHash();
        return currentHash === storedHash;
    }
}

// Singleton instance
let instance: DeviceFingerprintService | null = null;

/**
 * Get the singleton DeviceFingerprintService instance
 */
export function getDeviceFingerprintService(): DeviceFingerprintService {
    if (!instance) {
        instance = new DeviceFingerprintService();
    }
    return instance;
}

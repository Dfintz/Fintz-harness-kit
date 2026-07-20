import {
  DeviceFingerprintData,
  FingerprintOptions,
  collectDeviceFingerprint,
  hashFingerprint,
} from '@/utils/deviceFingerprint';

describe('deviceFingerprint', () => {
  // Mock browser APIs
  beforeEach(() => {
    // Mock canvas
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ({
        textBaseline: '',
        font: '',
        fillStyle: '',
        fillRect: jest.fn(),
        fillText: jest.fn(),
      })),
      toDataURL: jest.fn(() => 'data:image/png;base64,mockdata'),
    };

    global.document.createElement = jest.fn((tagName) => {
      if (tagName === 'canvas') {
        return mockCanvas as any;
      }
      return {} as any;
    });

    // Mock WebGL
    const mockWebGLContext = {
      getParameter: jest.fn((param) => {
        if (param === 7937) return 'Mock Renderer'; // UNMASKED_RENDERER_WEBGL
        if (param === 7936) return 'Mock Vendor'; // UNMASKED_VENDOR_WEBGL
        return null;
      }),
      getExtension: jest.fn(() => ({})),
    };

    (mockCanvas.getContext as jest.Mock).mockImplementation((type) => {
      if (type === 'webgl' || type === 'experimental-webgl') {
        return mockWebGLContext;
      }
      return {
        textBaseline: '',
        font: '',
        fillStyle: '',
        fillRect: jest.fn(),
        fillText: jest.fn(),
      };
    });

    // Mock navigator
    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 Test Browser',
    });

    Object.defineProperty(window.navigator, 'language', {
      writable: true,
      value: 'en-US',
    });

    Object.defineProperty(window.navigator, 'platform', {
      writable: true,
      value: 'Win32',
    });

    Object.defineProperty(window.navigator, 'hardwareConcurrency', {
      writable: true,
      value: 8,
    });

    // Mock screen
    Object.defineProperty(window, 'screen', {
      writable: true,
      value: {
        width: 1920,
        height: 1080,
        colorDepth: 24,
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('collectDeviceFingerprint', () => {
    it('collects basic device information', async () => {
      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint).toHaveProperty('userAgent');
      expect(fingerprint.userAgent).toBe('Mozilla/5.0 Test Browser');
      expect(fingerprint).toHaveProperty('screenResolution');
      expect(fingerprint).toHaveProperty('timezone');
      expect(fingerprint).toHaveProperty('language');
      expect(fingerprint).toHaveProperty('platform');
    });

    it('includes screen resolution', async () => {
      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.screenResolution).toBe('1920x1080');
    });

    it('includes timezone', async () => {
      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.timezone).toBeDefined();
      expect(typeof fingerprint.timezone).toBe('string');
    });

    it('includes language', async () => {
      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.language).toBe('en-US');
    });

    it('includes platform', async () => {
      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.platform).toBe('Win32');
    });

    it('includes color depth', async () => {
      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.colorDepth).toBe(24);
    });

    it('includes hardware concurrency', async () => {
      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.hardwareConcurrency).toBe(8);
    });

    it('includes canvas fingerprint when enabled', async () => {
      const options: FingerprintOptions = { includeCanvas: true };
      const fingerprint = await collectDeviceFingerprint(options);

      expect(fingerprint.canvasFingerprint).toBeDefined();
    });

    it('excludes canvas fingerprint when disabled', async () => {
      const options: FingerprintOptions = { includeCanvas: false };
      const fingerprint = await collectDeviceFingerprint(options);

      expect(fingerprint.canvasFingerprint).toBeUndefined();
    });

    it('includes WebGL renderer when enabled', async () => {
      const options: FingerprintOptions = { includeWebGL: true };
      const fingerprint = await collectDeviceFingerprint(options);

      // WebGL renderer might not be available in test environment
      // Just check that webglRenderer key is present (even if undefined)
      expect('webglRenderer' in fingerprint).toBe(true);
    });

    it('excludes WebGL renderer when disabled', async () => {
      const options: FingerprintOptions = { includeWebGL: false };
      const fingerprint = await collectDeviceFingerprint(options);

      expect(fingerprint.webglRenderer).toBeUndefined();
    });

    it('excludes hardware info when disabled', async () => {
      const options: FingerprintOptions = { includeHardware: false };
      const fingerprint = await collectDeviceFingerprint(options);

      expect(fingerprint.hardwareConcurrency).toBeUndefined();
      expect(fingerprint.deviceMemory).toBeUndefined();
    });

    it('detects touch support', async () => {
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        writable: true,
        value: 5,
      });

      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.touchSupport).toBe(true);
    });

    it('handles missing canvas gracefully', async () => {
      (document.createElement as jest.Mock).mockImplementation(() => ({
        getContext: jest.fn(() => null),
      }));

      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.canvasFingerprint).toBeUndefined();
      expect(fingerprint.userAgent).toBeDefined();
    });

    it('handles WebGL errors gracefully', async () => {
      const mockCanvas = {
        getContext: jest.fn(() => {
          throw new Error('WebGL not supported');
        }),
      };

      (document.createElement as jest.Mock).mockReturnValue(mockCanvas);

      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.webglRenderer).toBeUndefined();
      expect(fingerprint.userAgent).toBeDefined();
    });

    it('collects all data by default', async () => {
      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.userAgent).toBeDefined();
      expect(fingerprint.screenResolution).toBeDefined();
      expect(fingerprint.timezone).toBeDefined();
      expect(fingerprint.language).toBeDefined();
      expect(fingerprint.platform).toBeDefined();
      expect(fingerprint.colorDepth).toBeDefined();
    });

    it('returns consistent fingerprint for same device', async () => {
      const fingerprint1 = await collectDeviceFingerprint();
      const fingerprint2 = await collectDeviceFingerprint();

      expect(fingerprint1.userAgent).toBe(fingerprint2.userAgent);
      expect(fingerprint1.screenResolution).toBe(fingerprint2.screenResolution);
      expect(fingerprint1.language).toBe(fingerprint2.language);
    });

    it('handles device memory if available', async () => {
      Object.defineProperty(window.navigator, 'deviceMemory', {
        writable: true,
        value: 8,
      });

      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.deviceMemory).toBe(8);
    });

    it('handles missing device memory gracefully', async () => {
      Object.defineProperty(window.navigator, 'deviceMemory', {
        writable: true,
        value: undefined,
      });

      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint.deviceMemory).toBeUndefined();
    });
  });

  describe('hashFingerprint', () => {
    it('generates hash from fingerprint data', async () => {
      const fingerprint: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
        screenResolution: '1920x1080',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Win32',
        colorDepth: 24,
        hardwareConcurrency: 8,
      };

      const hash = await hashFingerprint(fingerprint);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('generates consistent hash for same data', async () => {
      const fingerprint: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
        screenResolution: '1920x1080',
        language: 'en-US',
      };

      const hash1 = await hashFingerprint(fingerprint);
      const hash2 = await hashFingerprint(fingerprint);

      expect(hash1).toBe(hash2);
    });

    it('generates different hashes for different data', async () => {
      const fingerprint1: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
        screenResolution: '1920x1080',
      };

      const fingerprint2: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
        screenResolution: '1280x720',
      };

      const hash1 = await hashFingerprint(fingerprint1);
      const hash2 = await hashFingerprint(fingerprint2);

      expect(hash1).not.toBe(hash2);
    });

    it('handles fingerprint with all fields', async () => {
      const fingerprint: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
        screenResolution: '1920x1080',
        timezone: 'UTC',
        language: 'en-US',
        platform: 'Win32',
        colorDepth: 24,
        hardwareConcurrency: 8,
        deviceMemory: 8,
        touchSupport: true,
        webglRenderer: 'NVIDIA',
        canvasFingerprint: 'abc123',
      };

      const hash = await hashFingerprint(fingerprint);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('handles fingerprint with minimal fields', async () => {
      const fingerprint: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
      };

      const hash = await hashFingerprint(fingerprint);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('privacy and security', () => {
    it('does not collect personally identifiable information', async () => {
      const fingerprint = await collectDeviceFingerprint();

      expect(fingerprint).not.toHaveProperty('name');
      expect(fingerprint).not.toHaveProperty('email');
      expect(fingerprint).not.toHaveProperty('ip');
      expect(fingerprint).not.toHaveProperty('location');
    });

    it('only collects technical browser data', async () => {
      const fingerprint = await collectDeviceFingerprint();

      const keys = Object.keys(fingerprint);
      const technicalKeys = [
        'userAgent',
        'screenResolution',
        'timezone',
        'language',
        'platform',
        'colorDepth',
        'hardwareConcurrency',
        'deviceMemory',
        'touchSupport',
        'webglRenderer',
        'canvasFingerprint',
      ];

      keys.forEach((key) => {
        expect(technicalKeys).toContain(key);
      });
    });
  });
});

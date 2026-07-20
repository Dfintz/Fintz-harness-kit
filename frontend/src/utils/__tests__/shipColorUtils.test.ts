import { createTheme } from '@mui/material/styles';
import {
    formatShipLabel,
    getCareerColor,
    getManufacturerColor,
    getRoleColor,
    getSizeColor,
} from '../shipColorUtils';

const theme = createTheme();

describe('shipColorUtils', () => {
  describe('formatShipLabel', () => {
    it('capitalises single words', () => {
      expect(formatShipLabel('combat')).toBe('Combat');
    });

    it('converts underscores to spaces and capitalises each word', () => {
      expect(formatShipLabel('sub_capital')).toBe('Sub Capital');
    });

    it('converts hyphens to spaces and capitalises each word', () => {
      expect(formatShipLabel('multi-role')).toBe('Multi Role');
    });

    it('handles already capitalised input', () => {
      expect(formatShipLabel('Combat')).toBe('Combat');
    });
  });

  describe('getCareerColor', () => {
    it('returns a colour for known careers', () => {
      expect(getCareerColor('combat', theme)).toBe(theme.palette.error.main);
      expect(getCareerColor('exploration', theme)).toBe(theme.palette.info.main);
    });

    it('is case-insensitive', () => {
      expect(getCareerColor('COMBAT', theme)).toBe(theme.palette.error.main);
    });

    it('returns fallback for unknown careers', () => {
      expect(getCareerColor('unknown', theme)).toBe(theme.palette.grey[500]);
    });
  });

  describe('getRoleColor', () => {
    it('returns a colour for known roles', () => {
      expect(getRoleColor('mining', theme)).toBe(theme.palette.warning.dark);
      expect(getRoleColor('medical', theme)).toBe(theme.palette.success.main);
    });

    it('returns fallback for unknown roles', () => {
      expect(getRoleColor('pirate', theme)).toBe(theme.palette.text.secondary);
    });
  });

  describe('getSizeColor', () => {
    it('returns a colour for known sizes', () => {
      expect(getSizeColor('capital', theme)).toBe(theme.palette.error.main);
      expect(getSizeColor('small', theme)).toBe(theme.palette.info.light);
    });

    it('handles sub_capital', () => {
      expect(getSizeColor('sub_capital', theme)).toBe(theme.palette.error.light);
    });

    it('returns fallback for unknown sizes', () => {
      expect(getSizeColor('tiny', theme)).toBe(theme.palette.text.secondary);
    });
  });

  describe('getManufacturerColor', () => {
    it('returns a colour for known manufacturers', () => {
      expect(getManufacturerColor('drake', theme)).toBe(theme.palette.warning.main);
    });

    it('handles full manufacturer names', () => {
      expect(getManufacturerColor('aegis dynamics', theme)).toBe(theme.palette.error.main);
    });

    it('returns fallback for unknown manufacturers', () => {
      expect(getManufacturerColor('unknown corp', theme)).toBe(theme.palette.text.secondary);
    });
  });
});

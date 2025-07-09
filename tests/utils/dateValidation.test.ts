import { describe, it, expect } from 'vitest';
import { insertMatchSchema } from '../../shared/schema';

describe('Date Validation Schema', () => {
  describe('Valid Date Formats', () => {
    it('should accept ISO date string with timezone', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '2025-01-15T10:00:00.000Z',
        lineupBudget: 100
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
        expect(result.data.date.toISOString()).toBe('2025-01-15T10:00:00.000Z');
      }
    });

    it('should accept ISO date string without timezone', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '2025-01-15T10:00:00',
        lineupBudget: 100
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
      }
    });

    it('should accept datetime-local format', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '2025-01-15T19:00',
        lineupBudget: 100
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
      }
    });

    it('should accept date with milliseconds', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '2025-01-15T10:00:00.123Z',
        lineupBudget: 100
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
      }
    });

    it('should accept date with offset timezone', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '2025-01-15T10:00:00+02:00',
        lineupBudget: 100
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
      }
    });
  });

  describe('Invalid Date Formats', () => {
    it('should reject invalid date string', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: 'invalid-date',
        lineupBudget: 100
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('date');
      }
    });

    it('should reject empty date string', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '',
        lineupBudget: 100
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('date');
      }
    });

    it('should reject numeric date', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: 1705401600000, // timestamp number
        lineupBudget: 100
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('date');
      }
    });

    it('should reject Date object directly', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: new Date('2025-01-15T10:00:00Z'),
        lineupBudget: 100
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('date');
      }
    });

    it('should reject malformed ISO string', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '2025-13-45T25:70:00Z', // invalid month/day/time
        lineupBudget: 100
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('date');
      }
    });
  });

  describe('Date Transformation', () => {
    it('should transform valid string to Date object', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '2025-01-15T10:00:00Z',
        lineupBudget: 100
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
        expect(result.data.date.getFullYear()).toBe(2025);
        expect(result.data.date.getMonth()).toBe(0); // January is 0
        expect(result.data.date.getDate()).toBe(15);
      }
    });

    it('should preserve timezone information', () => {
      const utcString = '2025-01-15T10:00:00Z';
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: utcString,
        lineupBudget: 100
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date.toISOString()).toBe('2025-01-15T10:00:00.000Z');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year dates', () => {
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '2024-02-29T10:00:00Z', // leap year
        lineupBudget: 100
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date.getMonth()).toBe(1); // February
        expect(result.data.date.getDate()).toBe(29);
      }
    });

    it('should handle invalid leap year dates gracefully', () => {
      // JavaScript Date constructor is permissive and converts invalid dates
      // '2023-02-29' becomes '2023-03-01' which is still a valid date
      const result = insertMatchSchema.safeParse({
        leagueId: 1,
        date: '2023-02-29T10:00:00Z', // not a leap year, but JS converts it
        lineupBudget: 100
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // JavaScript converts Feb 29 in non-leap year to Mar 1
        expect(result.data.date.getMonth()).toBe(2); // March is 2
        expect(result.data.date.getDate()).toBe(1);
      }
    });

    it('should handle different time formats', () => {
      const timeFormats = [
        '2025-01-15T00:00:00Z',
        '2025-01-15T12:30:45Z',
        '2025-01-15T23:59:59Z'
      ];

      timeFormats.forEach(dateString => {
        const result = insertMatchSchema.safeParse({
          leagueId: 1,
          date: dateString,
          lineupBudget: 100
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.date).toBeInstanceOf(Date);
        }
      });
    });
  });
});
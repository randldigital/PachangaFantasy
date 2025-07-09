import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest } from '../../client/src/lib/queryClient';

// Mock fetch to test the API request format
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Request Format Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve('{"success": true}'),
      status: 200,
      statusText: 'OK',
    });
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'mock-token'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Correct API Request Format', () => {
    it('should use method as first parameter for DELETE requests', async () => {
      await apiRequest('DELETE', '/api/matches/1');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/matches/1', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token',
        },
        body: undefined,
        credentials: 'include',
      });
    });

    it('should use method as first parameter for POST requests', async () => {
      const testData = { name: 'Test Match' };
      await apiRequest('POST', '/api/matches', testData);
      
      expect(mockFetch).toHaveBeenCalledWith('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token',
        },
        body: JSON.stringify(testData),
        credentials: 'include',
      });
    });

    it('should use method as first parameter for PUT requests', async () => {
      const testData = { status: 'completed' };
      await apiRequest('PUT', '/api/matches/1', testData);
      
      expect(mockFetch).toHaveBeenCalledWith('/api/matches/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token',
        },
        body: JSON.stringify(testData),
        credentials: 'include',
      });
    });

    it('should use method as first parameter for GET requests', async () => {
      await apiRequest('GET', '/api/matches/1');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/matches/1', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-token',
        },
        body: undefined,
        credentials: 'include',
      });
    });

    it('should include Authorization header when token is present', async () => {
      await apiRequest('DELETE', '/api/matches/1');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/matches/1', 
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });

    it('should not include Authorization header when token is not present', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      
      await apiRequest('DELETE', '/api/matches/1');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/matches/1', {
        method: 'DELETE',
        headers: {},
        body: undefined,
        credentials: 'include',
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-ok responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Match not found'),
      });

      await expect(apiRequest('DELETE', '/api/matches/999')).rejects.toThrow('404: Match not found');
    });

    it('should throw error with statusText when response text is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(''),
      });

      await expect(apiRequest('DELETE', '/api/matches/1')).rejects.toThrow('500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(apiRequest('DELETE', '/api/matches/1')).rejects.toThrow('Network error');
    });
  });

  describe('Request Body Handling', () => {
    it('should stringify JSON data for POST requests', async () => {
      const testData = { name: 'Test Match', date: '2025-01-01' };
      await apiRequest('POST', '/api/matches', testData);
      
      expect(mockFetch).toHaveBeenCalledWith('/api/matches', 
        expect.objectContaining({
          body: JSON.stringify(testData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should not include body for GET requests', async () => {
      await apiRequest('GET', '/api/matches');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/matches', 
        expect.objectContaining({
          body: undefined,
          headers: expect.not.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should not include body for DELETE requests', async () => {
      await apiRequest('DELETE', '/api/matches/1');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/matches/1', 
        expect.objectContaining({
          body: undefined,
          headers: expect.not.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });
});
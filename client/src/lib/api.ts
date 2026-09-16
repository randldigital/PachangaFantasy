import { ApiError } from "./apiError";
import { apiRequest } from "./queryClient";

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export const api = {
  get: async <T>(url: string): Promise<T> => {
    const response = await apiRequest("GET", url);
    return parseJson<T>(response);
  },

  getOrNull: async <T>(url: string): Promise<T | null> => {
    try {
      const response = await apiRequest("GET", url);
      return parseJson<T>(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  post: async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await apiRequest("POST", url, data);
    return parseJson<T>(response);
  },

  patch: async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await apiRequest("PATCH", url, data);
    return parseJson<T>(response);
  },

  delete: async <T>(url: string): Promise<T> => {
    const response = await apiRequest("DELETE", url);
    return parseJson<T>(response);
  },
};

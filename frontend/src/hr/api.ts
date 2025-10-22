import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";

/** Requests use the local proxy; authentication stays in the request headers. */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/sign-in") useAuthStore.getState().logout();
    throw new Error(
      data.message || data.error || "The request could not be completed. Please try again.",
    );
  }
  return data as T;
}

export function useApi<T>(path: string, enabled = true) {
  return useQuery<T, Error>({ queryKey: ["hr", path], queryFn: () => api<T>(path), enabled });
}

/** Refresh screens only after the server confirms a successful change. */
export function useAction<T>(action: (value: T) => Promise<unknown>, message: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await cache.invalidateQueries();
      toast.success(message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function json(method: string, data?: unknown): RequestInit {
  return { method, ...(data === undefined ? {} : { body: JSON.stringify(data) }) };
}

export function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDate(value: string, short = false) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
  });
}

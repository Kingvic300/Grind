import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError, api } from './api';
import type { Hackathon, HackathonInput, User } from './types';

const ME = ['me'];
const HACKATHONS = ['hackathons'];

/** The logged-in user, or null when nobody is logged in. */
export function useMe() {
  return useQuery({
    queryKey: ME,
    queryFn: async () => {
      try {
        return await api<User>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useAuthActions() {
  const client = useQueryClient();
  const start = (user: User) => {
    client.clear();
    client.setQueryData(ME, user);
  };
  return {
    signup: (body: { name: string; email: string; password: string }) =>
      api<User>('/auth/signup', { method: 'POST', body }).then(start),
    login: (body: { email: string; password: string }) => api<User>('/auth/login', { method: 'POST', body }).then(start),
    logout: async () => {
      await api('/auth/logout', { method: 'POST' });
      client.clear();
      client.setQueryData(ME, null);
    },
    updateProfile: (body: { name?: string; emailReminders?: boolean }) =>
      api<User>('/auth/me', { method: 'PATCH', body }).then((user) => client.setQueryData(ME, user)),
  };
}

export function useHackathons() {
  return useQuery({ queryKey: HACKATHONS, queryFn: () => api<Hackathon[]>('/hackathons') });
}

export function useSaveHackathon() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: HackathonInput }) =>
      id
        ? api<Hackathon>(`/hackathons/${id}`, { method: 'PATCH', body: input })
        : api<Hackathon>('/hackathons', { method: 'POST', body: input }),
    // Show the change at once (used by the board), and roll back if the server rejects it.
    onMutate: async ({ id, input }) => {
      if (!id) return undefined;
      await client.cancelQueries({ queryKey: HACKATHONS });
      const previous = client.getQueryData<Hackathon[]>(HACKATHONS);
      client.setQueryData<Hackathon[]>(HACKATHONS, (list) => list?.map((h) => (h.id === id ? { ...h, ...input } : h)));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(HACKATHONS, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: HACKATHONS }),
  });
}

export function useDeleteHackathon() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/hackathons/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: HACKATHONS }),
  });
}

/** Current time, refreshed every second. Drives the live countdowns. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { API_URL, ApiError, api } from './api';
import { useSpaceId } from './space';
import type { DiscoverResult, Hackathon, HackathonInput, InvitePreview, Space, User } from './types';

const ME = ['me'];
const HACKATHONS = ['hackathons'];
const SPACES = ['spaces'];

/** Cache key for one list: the private list, or a shared list. */
const hackathonsKey = (spaceId: string | null) => [...HACKATHONS, spaceId ?? 'mine'];

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

/** Hackathons in the list the app is showing. */
export function useHackathons() {
  const { spaceId } = useSpaceId();
  return useQuery({
    queryKey: hackathonsKey(spaceId),
    queryFn: () => api<Hackathon[]>(spaceId ? `/hackathons?space=${encodeURIComponent(spaceId)}` : '/hackathons'),
  });
}

export function useSaveHackathon() {
  const client = useQueryClient();
  const { spaceId } = useSpaceId();
  const key = hackathonsKey(spaceId);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: HackathonInput }) =>
      id
        ? api<Hackathon>(`/hackathons/${id}`, { method: 'PATCH', body: input })
        : api<Hackathon>('/hackathons', { method: 'POST', body: { ...input, spaceId } }),
    // Show the change at once (used by the board), and roll back if the server rejects it.
    onMutate: async ({ id, input }) => {
      if (!id) return undefined;
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Hackathon[]>(key);
      client.setQueryData<Hackathon[]>(key, (list) => list?.map((h) => (h.id === id ? { ...h, ...input } : h)));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteHackathon() {
  const client = useQueryClient();
  const { spaceId } = useSpaceId();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/hackathons/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: hackathonsKey(spaceId) }),
  });
}

/** Open and upcoming hackathons from Devpost, DoraHacks, Devfolio and MLH. */
export function useDiscover() {
  return useQuery({ queryKey: ['discover'], queryFn: () => api<DiscoverResult>('/discover'), staleTime: 10 * 60_000 });
}

/** Shared lists the user is a member of. */
export function useSpaces() {
  return useQuery({ queryKey: SPACES, queryFn: () => api<Space[]>('/spaces') });
}

export function useSpaceActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: SPACES });
  return {
    create: (name: string) => api<Space>('/spaces', { method: 'POST', body: { name } }).finally(refresh),
    rename: (id: string, name: string) => api<Space>(`/spaces/${id}`, { method: 'PATCH', body: { name } }).finally(refresh),
    resetInvite: (id: string) => api<Space>(`/spaces/${id}/invite/reset`, { method: 'POST' }).finally(refresh),
    removeMember: (id: string, userId: string) =>
      api<void>(`/spaces/${id}/members/${userId}`, { method: 'DELETE' }).finally(refresh),
    remove: (id: string) => api<void>(`/spaces/${id}`, { method: 'DELETE' }).finally(refresh),
    join: (code: string) =>
      api<{ id: string }>(`/spaces/invite/${encodeURIComponent(code)}/join`, { method: 'POST' }).finally(refresh),
  };
}

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: ['invite', code],
    queryFn: () => api<InvitePreview>(`/spaces/invite/${encodeURIComponent(code)}`),
    retry: false,
  });
}

type LiveEvent = { type: 'hackathons'; spaceId: string | null } | { type: 'spaces' };

/**
 * Listens for changes made by other people (or other tabs) and refetches what changed,
 * so edits show up without a reload. EventSource reconnects by itself after a drop.
 */
export function useLiveUpdates(enabled: boolean) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;
    const source = new EventSource(`${API_URL}/api/events`, { withCredentials: true });
    let dropped = false;
    source.addEventListener('change', (message) => {
      let event: LiveEvent;
      try {
        event = JSON.parse((message as MessageEvent<string>).data) as LiveEvent;
      } catch {
        return;
      }
      if (event.type === 'hackathons') void client.invalidateQueries({ queryKey: hackathonsKey(event.spaceId) });
      else {
        // Membership changed: lists may have appeared or gone, so refetch both.
        void client.invalidateQueries({ queryKey: SPACES });
        void client.invalidateQueries({ queryKey: HACKATHONS });
      }
    });
    source.onerror = () => {
      dropped = true;
    };
    // Changes made while the connection was down were missed, so refetch everything.
    source.onopen = () => {
      if (!dropped) return;
      dropped = false;
      void client.invalidateQueries({ queryKey: SPACES });
      void client.invalidateQueries({ queryKey: HACKATHONS });
    };
    return () => source.close();
  }, [enabled, client]);
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

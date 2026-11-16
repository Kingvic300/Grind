import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { API_URL, ApiError, api } from './api';
import { useSpaceId } from './space';
import type { Activity, Comment, DiscoverResult, Hackathon, HackathonInput, InvitePreview, Space, Stats, Task, User, UserUpdate } from './types';

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
    updateProfile: (body: UserUpdate) =>
      api<User>('/auth/me', { method: 'PATCH', body }).then((user) => {
        client.setQueryData(ME, user);
        // Names and photos show inside shared lists too.
        void client.invalidateQueries({ queryKey: ['spaces'] });
        return user;
      }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      api<User>('/auth/password', { method: 'POST', body }).then((user) => client.setQueryData(ME, user)),
    signOutOthers: () => api<User>('/auth/sign-out-others', { method: 'POST' }).then((user) => client.setQueryData(ME, user)),
    exportData: () => api<Record<string, unknown>>('/auth/me/export'),
    deleteAccount: async (password: string) => {
      await api<void>('/auth/me/delete', { method: 'POST', body: { password } });
      client.clear();
      client.setQueryData(ME, null);
    },
  };
}

export function useStats() {
  return useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/auth/me/stats') });
}

/** The private calendar feed link. Null token means the feed is off. */
export function useCalendarFeed() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['calendar-feed'], queryFn: () => api<{ token: string | null }>('/auth/me/calendar') });
  const set = (data: { token: string | null }) => {
    client.setQueryData(['calendar-feed'], data);
    void client.invalidateQueries({ queryKey: ME });
  };
  return {
    query,
    rotate: () => api<{ token: string }>('/auth/me/calendar', { method: 'POST' }).then(set),
    disable: () => api<void>('/auth/me/calendar', { method: 'DELETE' }).then(() => set({ token: null })),
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

/** Open and upcoming hackathons from public sites, plus Superteam Earn bounties. */
export function useDiscover() {
  return useQuery({ queryKey: ['discover'], queryFn: () => api<DiscoverResult>('/discover'), staleTime: 10 * 60_000 });
}

/** Teams the user is in. */
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

/** Checklist items inside one hackathon. */
export function useTasks(hackathonId: string) {
  return useQuery({ queryKey: ['tasks', hackathonId], queryFn: () => api<Task[]>(`/hackathons/${hackathonId}/tasks`) });
}

export function useTaskActions(hackathonId: string) {
  const client = useQueryClient();
  const key = ['tasks', hackathonId];
  const { spaceId } = useSpaceId();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: key });
    // Board cards show task progress.
    void client.invalidateQueries({ queryKey: hackathonsKey(spaceId) });
  };
  return {
    add: (body: { title: string; assigneeId?: string | null }) =>
      api<Task>(`/hackathons/${hackathonId}/tasks`, { method: 'POST', body }).finally(refresh),
    update: async (taskId: string, body: Partial<{ title: string; done: boolean; assigneeId: string | null }>) => {
      // Tick boxes at once; the refetch puts things right if the server says no.
      client.setQueryData<Task[]>(key, (list) => list?.map((t) => (t.id === taskId && body.done !== undefined ? { ...t, done: body.done } : t)));
      return api<Task>(`/hackathons/${hackathonId}/tasks/${taskId}`, { method: 'PATCH', body }).finally(refresh);
    },
    remove: (taskId: string) => api<void>(`/hackathons/${hackathonId}/tasks/${taskId}`, { method: 'DELETE' }).finally(refresh),
  };
}

export function useComments(hackathonId: string) {
  return useQuery({ queryKey: ['comments', hackathonId], queryFn: () => api<Comment[]>(`/hackathons/${hackathonId}/comments`) });
}

export function useCommentActions(hackathonId: string) {
  const client = useQueryClient();
  const { spaceId } = useSpaceId();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['comments', hackathonId] });
    void client.invalidateQueries({ queryKey: hackathonsKey(spaceId) });
  };
  return {
    add: (body: string) => api<Comment>(`/hackathons/${hackathonId}/comments`, { method: 'POST', body: { body } }).finally(refresh),
    remove: (commentId: string) => api<void>(`/hackathons/${hackathonId}/comments/${commentId}`, { method: 'DELETE' }).finally(refresh),
  };
}

/** Latest entries in a team's activity feed. */
export function useActivity(spaceId: string) {
  return useQuery({ queryKey: ['activity', spaceId], queryFn: () => api<Activity[]>(`/spaces/${spaceId}/activity`) });
}

/** Older activity entries, before the given time. */
export const fetchOlderActivity = (spaceId: string, before: string) =>
  api<Activity[]>(`/spaces/${spaceId}/activity?before=${encodeURIComponent(before)}`);

type LiveEvent =
  | { type: 'hackathons'; spaceId: string | null }
  | { type: 'spaces' }
  | { type: 'activity'; spaceId: string }
  | { type: 'detail'; hackathonId: string };

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
      else if (event.type === 'activity') void client.invalidateQueries({ queryKey: ['activity', event.spaceId] });
      else if (event.type === 'detail') {
        void client.invalidateQueries({ queryKey: ['tasks', event.hackathonId] });
        void client.invalidateQueries({ queryKey: ['comments', event.hackathonId] });
      } else {
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
      void client.invalidateQueries({ queryKey: ['activity'] });
      void client.invalidateQueries({ queryKey: ['tasks'] });
      void client.invalidateQueries({ queryKey: ['comments'] });
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

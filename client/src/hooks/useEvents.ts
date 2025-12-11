import * as eventsService from '@/services/eventsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useEvents(enabled: boolean = true) {
  const query = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsService.listEvents(),
    enabled,
  });

  const events = (query.data as any)?.data ?? query.data ?? [];

  return { ...query, events };
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => eventsService.createEvent(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: any }) => eventsService.updateEvent(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => eventsService.deleteEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

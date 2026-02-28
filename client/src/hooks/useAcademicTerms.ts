import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';

export const useAcademicTerms = () => {
    const queryClient = useQueryClient();

    const { data: terms = [], isLoading, error } = useQuery({
        queryKey: ['academicTerms'],
        queryFn: async () => {
            const res = await settingsService.listTerms();
            return res.data || [];
        }
    });

    const createTermMutation = useMutation({
        mutationFn: (payload: any) => settingsService.createTerm(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['academicTerms'] });
            queryClient.invalidateQueries({ queryKey: ['activeTerm'] });
        }
    });

    const updateTermMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number | string; payload: any }) =>
            settingsService.updateTerm(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['academicTerms'] });
            queryClient.invalidateQueries({ queryKey: ['activeTerm'] });
        }
    });

    const deleteTermMutation = useMutation({
        mutationFn: (id: number | string) => settingsService.deleteTerm(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['academicTerms'] });
        }
    });

    const setActiveTermMutation = useMutation({
        mutationFn: (id: number | string) => settingsService.setActiveTerm(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['academicTerms'] });
            queryClient.invalidateQueries({ queryKey: ['activeTerm'] });
        }
    });

    return {
        terms,
        isLoading,
        error,
        createTerm: createTermMutation,
        updateTerm: updateTermMutation,
        deleteTerm: deleteTermMutation,
        setActiveTerm: setActiveTermMutation
    };
};

export default useAcademicTerms;

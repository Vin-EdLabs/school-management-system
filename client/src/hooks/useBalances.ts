import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import balancesService from '../services/balancesService';

export const useBalances = (termId?: number | string) => {
    const queryClient = useQueryClient();

    const { data: balances = [], isLoading } = useQuery({
        queryKey: ['balances', termId],
        queryFn: async () => {
            if (!termId) return [];
            const res = await balancesService.listByTerm(termId) as any;
            return res.data || [];
        },
        enabled: !!termId
    });

    const updateBalanceMutation = useMutation({
        mutationFn: ({ studentId, termId, data }: { studentId: number | string; term_id?: number | string; termId: number | string; data: any }) =>
            balancesService.updateBalance(studentId, termId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['balances', variables.termId] });
            queryClient.invalidateQueries({ queryKey: ['balance', variables.studentId, variables.termId] });
        }
    });

    // Helper to get balance as a map for easier lookup
    const balancesMap = (balances || []).reduce((acc: any, curr: any) => {
        acc[curr.student_id] = {
            arrears: Number(curr.arrears || 0),
            credit_balance: Number(curr.credit_balance || 0)
        };
        return acc;
    }, {});

    const arrearsMap = (balances || []).reduce((acc: any, curr: any) => {
        acc[curr.student_id] = Number(curr.arrears || 0);
        return acc;
    }, {});

    const creditMap = (balances || []).reduce((acc: any, curr: any) => {
        acc[curr.student_id] = Number(curr.credit_balance || 0);
        return acc;
    }, {});

    return {
        balances,
        balancesMap,
        arrearsMap,
        creditMap,
        isLoading,
        updateBalance: updateBalanceMutation
    };
};

export default useBalances;

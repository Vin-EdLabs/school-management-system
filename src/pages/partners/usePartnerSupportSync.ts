import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import type { PartnerSupportMessage } from '@/services/partnerApi';
import { usePartnerSocket } from './usePartnerSocket';

/** Live support updates — bell badge + toast when ScholarNerve replies (no email). */
export function usePartnerSupportSync(refresh: () => Promise<void>, enabled = true) {
  const { socket } = usePartnerSocket();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const onSupportPage = pathname.replace(/\/$/, '').endsWith('/support');

  useEffect(() => {
    if (!socket || !enabled) return;

    const onMessage = (msg: PartnerSupportMessage & { partner_id?: number }) => {
      try {
        if (!msg.is_from_superadmin) return;

        void refresh();
        void queryClient.invalidateQueries({ queryKey: ['partner', 'notifications'] });

        if (!onSupportPage) {
          toast({
            title: 'Support reply',
            description: msg.message.length > 140 ? `${msg.message.slice(0, 137)}…` : msg.message,
          });
        }
      } catch (err) {
        console.warn('[partner] Support sync handler failed', err);
      }
    };

    try {
      socket.on('new-partner-support-message', onMessage);
    } catch (err) {
      console.warn('[partner] Could not subscribe to support socket events', err);
      return;
    }

    return () => {
      try {
        socket.off('new-partner-support-message', onMessage);
      } catch {
        /* ignore cleanup errors */
      }
    };
  }, [socket, enabled, refresh, onSupportPage, queryClient]);
}

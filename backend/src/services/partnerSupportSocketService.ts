export type PartnerSupportMessagePayload = {
  id: number;
  partner_id: number;
  sender_role: string;
  sender_username: string | null;
  message: string;
  is_from_superadmin: boolean;
  read_at: string | null;
  created_at: string;
};

export async function emitPartnerSupportMessage(
  partnerDbId: number,
  row: Omit<PartnerSupportMessagePayload, 'partner_id'>,
): Promise<void> {
  try {
    const { getIO } = await import('../socket.js');
    const io = getIO();
    const payload: PartnerSupportMessagePayload = { ...row, partner_id: partnerDbId };
    io.to(`partner:${partnerDbId}`).emit('new-partner-support-message', payload);
    io.to('global:super-admin').emit('new-partner-support-message', payload);
  } catch (err) {
    console.error('Partner support socket emit error:', err);
  }
}

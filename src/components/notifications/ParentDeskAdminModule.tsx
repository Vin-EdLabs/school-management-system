import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '@/services/api';
import { MessageSquare, RefreshCw, Send, CheckCheck } from 'lucide-react';

const ParentDeskAdminModule: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [conversation, setConversation] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<any[]>('/messages/admin/list');
      setMessages(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const open = async (id: number) => {
    const data = await apiService.get<any>(`/messages/admin/${id}`);
    setSelected(data?.message || null);
    setConversation(Array.isArray(data?.replies) ? data.replies : []);
  };

  const filtered = useMemo(() => {
    return messages.filter((m) => (typeFilter === 'all' || m.type === typeFilter) && (statusFilter === 'all' || m.status === statusFilter));
  }, [messages, typeFilter, statusFilter]);

  useEffect(() => { load().catch(() => undefined); }, []);

  return (
    <div className="p-4 md:p-6 grid grid-cols-1 xl:grid-cols-[380px,1fr] gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-purple-600" /> Parent Desk</h3>
          <button onClick={() => load().catch(() => undefined)} className="text-slate-500 hover:text-purple-700"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="p-3 flex gap-2">
          <select className="border rounded-lg px-2 py-1.5 text-xs" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option><option value="absence">Absence</option><option value="fee">Fee</option><option value="academic">Academic</option><option value="teacher">Teacher</option><option value="late">Late</option><option value="general">General</option>
          </select>
          <select className="border rounded-lg px-2 py-1.5 text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All status</option><option value="pending">Pending</option><option value="in_review">In Review</option><option value="resolved">Resolved</option><option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-2 space-y-2 bg-[#f7f5f2]">
          {filtered.map((m) => (
            <button key={m.id} onClick={() => open(Number(m.id)).catch(() => undefined)} className="w-full text-left rounded-xl border border-slate-200 bg-white p-3 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-slate-800 truncate">{m.subject}</p>
                <span className="text-[10px] text-slate-400">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate">{m.first_name} {m.last_name} · {m.class_name || 'No class'}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] capitalize bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{String(m.status || '').replace('_', ' ')}</span>
                {Number(m.unread_parent_replies || 0) > 0 && <span className="text-[10px] font-semibold text-red-600">{m.unread_parent_replies} unread</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm min-h-[420px] flex flex-col overflow-hidden">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">Select a conversation from the left.</div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{selected.subject}</p>
                <p className="text-xs text-slate-500">{selected.first_name} {selected.last_name} · {selected.class_name || 'No class'} · ID {selected.admission_number || 'N/A'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => apiService.put(`/messages/admin/${selected.id}/status`, { status: 'urgent' }).then(load)} className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-700">Urgent</button>
                <button onClick={() => apiService.put(`/messages/admin/${selected.id}/status`, { status: 'resolved' }).then(load)} className="text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">Resolved</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5] space-y-3">
              <div className="max-w-[86%] rounded-2xl rounded-bl-md bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm">
                {selected.message}
                <div className="mt-1 text-[10px] text-slate-400 text-right">{new Date(selected.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              {conversation.map((r) => (
                <div key={r.id} className={`flex ${r.sender_type === 'school' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm shadow-sm ${r.sender_type === 'school' ? 'bg-violet-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'}`}>
                    <p>{r.reply_text}</p>
                    <div className={`mt-1 text-[10px] flex items-center justify-end gap-1 ${r.sender_type === 'school' ? 'text-white/85' : 'text-slate-400'}`}>
                      {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {r.sender_type === 'school' && <CheckCheck className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-100">
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Reply to parent..." />
              <button
                onClick={async () => {
                  if (!reply.trim()) return;
                  await apiService.post(`/messages/admin/${selected.id}/reply`, { reply_text: reply.trim() });
                  setReply('');
                  await open(Number(selected.id));
                  await load();
                }}
                className="mt-2 rounded-lg bg-violet-600 text-white text-xs font-semibold px-3 py-2 inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Send reply
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ParentDeskAdminModule;

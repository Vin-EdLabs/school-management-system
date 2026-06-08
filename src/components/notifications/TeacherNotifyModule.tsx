import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Megaphone, Send, Sparkles } from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { toast } from 'sonner';

const TeacherNotifyModule = () => {
  const { schoolId } = useSchool();
  const [title, setTitle] = useState('Message from administration');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const body = message.trim();
    if (!body) {
      toast.error('Please enter a message for teachers and staff.');
      return;
    }
    setSending(true);
    try {
      if (schoolId != null) apiService.setTenantContext(schoolId);
      await apiService.post('/teachers/announce', { title: title.trim() || 'Message from school', message: body });
      toast.success('Notice sent', {
        description: 'Teachers and payroll staff will see a pop-up and can reopen it from the bell in the header.',
      });
      setMessage('');
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Could not send notice');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-0 bg-background px-4 py-6 sm:p-8 space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-3 sm:text-left sm:space-y-2">
        <div className="inline-flex sm:hidden items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20 mx-auto">
          <Megaphone className="h-7 w-7 text-white" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:gap-4">
          <div className="hidden sm:flex w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 items-center justify-center shrink-0 shadow-md">
            <Megaphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Notify teachers and staff</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base max-w-xl">
              Send an in-app message to every teacher and payroll staff member. They get the same style of alerts as parents, including salary updates when payroll records their pay.
            </p>
          </div>
        </div>
      </div>

      <Card className="border-border/80 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border-b border-border/60">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Compose notice
          </CardTitle>
          <CardDescription>Title and body are delivered instantly over the live connection.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="tn-title">Title</Label>
            <Input
              id="tn-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short headline"
              className="h-12 rounded-xl"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tn-body">Message</Label>
            <Textarea
              id="tn-body"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Staff meeting Friday 3pm in the staff room…"
              rows={6}
              className="min-h-[140px] rounded-xl resize-y text-base sm:text-sm"
              maxLength={800}
            />
            <p className="text-xs text-muted-foreground text-right">{message.length} / 800</p>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto min-h-[48px] rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-md"
            disabled={sending}
            onClick={handleSend}
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending…' : 'Send to teachers'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherNotifyModule;

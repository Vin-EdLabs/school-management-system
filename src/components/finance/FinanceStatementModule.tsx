import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Search, X, Download, Send } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { shouldTrackStudentFees } from '../students/studentRegistryUtils';
import {
  fetchStudentFinanceStatement,
  logFinanceStatementDownload,
  sendFinanceStatementToParent,
  type StudentFinanceStatement,
} from '../../services/studentFinanceStatementApi';
import { FinanceStatementPreview } from './FinanceStatementModal';
import {
  buildFinanceStatementFilename,
  downloadFinanceStatementPdf,
} from './buildFinanceStatementPdf';
import { resolveLogoUrl } from '../../services/tenantService';
import { toast } from '@/hooks/use-toast';

type SelectedStudent = {
  id: number | string;
  label: string;
  studentId: string;
  className: string;
};

const FinanceStatementModule: React.FC = () => {
  const { students } = useData();
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<SelectedStudent | null>(null);
  const [statement, setStatement] = useState<StudentFinanceStatement | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (students || [])
      .filter(shouldTrackStudentFees)
      .filter((s) => {
        const name = `${s.firstName} ${s.lastName}`.toLowerCase();
        const id = String(s.studentId || '').toLowerCase();
        return name.includes(q) || id.includes(q);
      })
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        label: `${s.firstName} ${s.lastName}`,
        studentId: s.studentId,
        className: s.classAssigned || '—',
      }));
  }, [students, search]);

  const loadStatement = async (student: SelectedStudent) => {
    setLoading(true);
    setStatement(null);
    try {
      const data = await fetchStudentFinanceStatement(student.id);
      setStatement(data);
      setLogoUrl(resolveLogoUrl(data.header.logoUrl));
    } catch (e: unknown) {
      toast({
        title: 'Could not load statement',
        description: (e as Error).message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (student: SelectedStudent) => {
    setSelected(student);
    setSearch(`${student.label} (${student.studentId})`);
    setShowDropdown(false);
    void loadStatement(student);
  };

  const handleClear = () => {
    setSearch('');
    setSelected(null);
    setStatement(null);
    setLogoUrl(null);
    setShowDropdown(false);
  };

  const handleDownload = async () => {
    if (!statement || !selected || !previewRef.current) return;
    setDownloading(true);
    try {
      await logFinanceStatementDownload(selected.id);
      const filename = buildFinanceStatementFilename(statement.header.studentName, statement.header.studentId);
      await downloadFinanceStatementPdf(previewRef.current, filename);
      toast({ title: 'Download started', description: 'Finance statement PDF is downloading.' });
    } catch (e: unknown) {
      toast({
        title: 'Download failed',
        description: (e as Error).message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleSendToParent = async () => {
    if (!statement || !selected) return;
    setSending(true);
    try {
      const result = await sendFinanceStatementToParent(selected.id);
      toast({
        title: 'Sent to parents',
        description:
          result.parentAccounts === 1
            ? '1 parent account was notified. They can view and download the statement on the parent portal.'
            : `${result.parentAccounts} parent accounts were notified. They can view and download the statement on the parent portal.`,
      });
    } catch (e: unknown) {
      toast({
        title: 'Could not send to parents',
        description: (e as Error).message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Finance Statement</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Search for a student to preview, download, or send their finance statement to parents on the portal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find student</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
                if (!e.target.value.trim()) handleClear();
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by student name or student ID..."
              className="pl-10 pr-10"
            />
            {search ? (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {showDropdown && search.trim() && matches.length > 0 && !selected ? (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
                {matches.map((m) => (
                  <button
                    key={String(m.id)}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                    onClick={() => handleSelect(m)}
                  >
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground"> · {m.studentId} · {m.className}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-16 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading statement…
          </CardContent>
        </Card>
      ) : !selected || !statement ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Search for a student to generate their finance statement</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-6 bg-white">
              <FinanceStatementPreview ref={previewRef} statement={statement} logoUrl={logoUrl} />
            </CardContent>
          </Card>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              variant="outline"
              className="min-w-[220px] border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              onClick={() => void handleSendToParent()}
              disabled={sending || downloading}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to Parents
                </>
              )}
            </Button>
            <Button
              size="lg"
              className="min-w-[220px] bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void handleDownload()}
              disabled={downloading || sending}
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating PDF…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceStatementModule;

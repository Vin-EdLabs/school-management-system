import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useSchool } from '../../contexts/SchoolContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { teacherSubjectsMatch, normalizeTeacherSubjectKey, teacherSubjectDisplayLabel } from '@/utils/teacherSubjectKey';
import {
  ArrowLeft,
  BookMarked,
  Calendar,
  ClipboardList,
  Layers,
  Loader2,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  GraduationCap,
  ListChecks,
} from 'lucide-react';

type QuestionKind = 'mcq' | 'true_false';

type BankRow = {
  id: number;
  subject: string;
  itemTitle?: string | null;
  questionType: QuestionKind;
  questionText: string;
  options: { a: string; b: string; c: string; d: string };
  correctOption: string;
  marks: number;
};

type DraftQuestion = {
  questionType: QuestionKind;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'a' | 'b' | 'c' | 'd';
  marks: string;
};

const emptyCustom = (t: QuestionKind = 'mcq'): DraftQuestion => ({
  questionType: t,
  questionText: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctOption: 'a',
  marks: '1',
});

function customToPayload(q: DraftQuestion) {
  const marks = Math.max(1, Number(q.marks || '1'));
  if (q.questionType === 'true_false') {
    return {
      question_text: q.questionText.trim(),
      question_type: 'true_false',
      option_a: 'True',
      option_b: 'False',
      option_c: '',
      option_d: '',
      correct_option: q.correctOption === 'b' ? 'b' : 'a',
      marks,
    };
  }
  return {
    question_text: q.questionText.trim(),
    question_type: 'mcq',
    option_a: q.optionA.trim(),
    option_b: q.optionB.trim(),
    option_c: q.optionC.trim(),
    option_d: q.optionD.trim(),
    correct_option: q.correctOption,
    marks,
  };
}

function isCustomValid(q: DraftQuestion): boolean {
  const t = q.questionText.trim();
  if (!t) return false;
  if (q.questionType === 'true_false') return ['a', 'b'].includes(q.correctOption);
  return !!(q.optionA.trim() && q.optionB.trim() && q.optionC.trim() && q.optionD.trim() && ['a', 'b', 'c', 'd'].includes(q.correctOption));
}

const TeacherQuizModule = () => {
  const { schoolId } = useSchool();
  const { user } = useAuth();
  const { classes, subjects } = useData();
  const [mainTab, setMainTab] = useState<'bank' | 'assessments'>('assessments');

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [classId, setClassId] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [selectedQuizMeta, setSelectedQuizMeta] = useState<any | null>(null);
  const [selectedView, setSelectedView] = useState<'results' | 'questions'>('results');
  const [results, setResults] = useState<any[]>([]);
  const [questionSet, setQuestionSet] = useState<any[]>([]);
  const [customQuestions, setCustomQuestions] = useState<DraftQuestion[]>([]);
  const [selectedBankIds, setSelectedBankIds] = useState<number[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<Array<{ id: number; class_name: string }>>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [publishMode, setPublishMode] = useState(false);

  const [bankItems, setBankItems] = useState<BankRow[]>([]);
  const [bankSubjectFilter, setBankSubjectFilter] = useState<string>('__all__');
  const [bankLoading, setBankLoading] = useState(false);
  const [newBank, setNewBank] = useState({
    subject: '',
    itemTitle: '',
    questionType: 'mcq' as QuestionKind,
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'a' as 'a' | 'b' | 'c' | 'd',
    marks: '1',
  });

  const teacherApiUser = useMemo(
    () => !!(user && (user.role === 'teacher' || (user.role === 'staff' && user.teacherId))),
    [user]
  );

  const loadQuizzes = useCallback(async () => {
    const data = await apiService.get<{ quizzes?: any[] }>('/student/teacher-quizzes/my').catch(() => ({ quizzes: [] }));
    setQuizzes(Array.isArray(data.quizzes) ? data.quizzes : []);
  }, []);

  const loadBank = useCallback(async (opts?: { allSubjects?: boolean }) => {
    setBankLoading(true);
    try {
      const q =
        !opts?.allSubjects && bankSubjectFilter && bankSubjectFilter !== '__all__'
          ? `?subject=${encodeURIComponent(bankSubjectFilter)}`
          : '';
      const data = await apiService.get<{ questions?: BankRow[] }>(`/student/question-bank${q}`).catch(() => ({ questions: [] }));
      setBankItems(Array.isArray(data.questions) ? data.questions : []);
    } finally {
      setBankLoading(false);
    }
  }, [bankSubjectFilter]);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
    loadQuizzes().catch(() => undefined);
    if (teacherApiUser) {
      apiService
        .get<Array<{ id: number; class_name: string }>>('/teachers/me/classes')
        .then((r) => setTeacherClasses(Array.isArray(r) ? r : []))
        .catch(() => setTeacherClasses([]));
      apiService
        .get<{ by_subject?: Array<{ subject_name: string }> }>('/teachers/me/subject-classes')
        .then((r) => {
          const names = (r?.by_subject || []).map((s) => s.subject_name).filter(Boolean);
          setTeacherSubjects(names.length ? names : []);
        })
        .catch(() => {
          apiService
            .get<{ subjects_taught?: string[] }>('/teachers/me')
            .then((r) => setTeacherSubjects(Array.isArray(r?.subjects_taught) ? r.subjects_taught : []))
            .catch(() => setTeacherSubjects([]));
        });
    } else {
      setTeacherClasses([]);
      setTeacherSubjects([]);
    }
  }, [schoolId, teacherApiUser, loadQuizzes]);

  useEffect(() => {
    if (mainTab === 'bank') loadBank().catch(() => undefined);
  }, [mainTab, loadBank]);

  useEffect(() => {
    if (mainTab === 'assessments') loadBank({ allSubjects: true }).catch(() => undefined);
  }, [mainTab, subject, loadBank]);

  const availableClasses = useMemo(() => {
    if (!teacherApiUser) return classes.map((c) => ({ id: Number(c.id), className: c.className }));
    const fromApi = teacherClasses.map((c) => ({ id: c.id, className: c.class_name }));
    const seen = new Set(fromApi.map((c) => c.id));
    const tid = user?.teacherId != null ? Number(user.teacherId) : NaN;
    const fallback = classes
      .filter((c) => Number.isFinite(tid) && Number(c.assignedTeacherId) === tid)
      .filter((c) => !seen.has(Number(c.id)))
      .map((c) => ({ id: Number(c.id), className: c.className }));
    return [...fromApi, ...fallback];
  }, [teacherApiUser, teacherClasses, classes, user?.teacherId]);

  const createdSubjects = useMemo(
    () => subjects.map((s) => String(s.name || '').trim()).filter(Boolean),
    [subjects]
  );

  const availableSubjects = useMemo(() => {
    if (!createdSubjects.length) return [];
    if (!teacherApiUser) return createdSubjects;
    if (!teacherSubjects.length) return createdSubjects;
    const normalizedTeacher = new Set(teacherSubjects.map((s) => s.toLowerCase().trim()));
    return createdSubjects.filter((s) => normalizedTeacher.has(s.toLowerCase().trim()));
  }, [createdSubjects, teacherSubjects, teacherApiUser]);

  useEffect(() => {
    if (!availableSubjects.length) {
      setSubject('');
      return;
    }
    const keys = new Set(availableSubjects.map((s) => normalizeTeacherSubjectKey(s)));
    const cur = normalizeTeacherSubjectKey(subject);
    if (!cur || !keys.has(cur)) {
      setSubject(normalizeTeacherSubjectKey(availableSubjects[0]));
    }
  }, [availableSubjects, subject]);

  const bankFilteredForComposer = useMemo(() => {
    if (!subject) return bankItems;
    return bankItems.filter((b) => teacherSubjectsMatch(b.subject, subject));
  }, [bankItems, subject]);

  const toggleBankId = (id: number) => {
    setSelectedBankIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const totalMarksPreview = useMemo(() => {
    let sum = 0;
    for (const id of selectedBankIds) {
      const b = bankItems.find((x) => x.id === id);
      if (b) sum += Math.max(1, Number(b.marks || 1));
    }
    for (const q of customQuestions) {
      if (isCustomValid(q)) sum += Math.max(1, Number(q.marks || '1'));
    }
    return sum;
  }, [selectedBankIds, bankItems, customQuestions]);

  const questionCountPreview = useMemo(() => {
    const customValid = customQuestions.filter(isCustomValid).length;
    return selectedBankIds.length + customValid;
  }, [selectedBankIds, customQuestions]);

  const loadResults = async (id: number) => {
    const data = await apiService
      .get<{ quiz?: any; attempts?: any[] }>(`/student/teacher-quizzes/${id}/results`)
      .catch(() => ({ attempts: [], quiz: null }));
    setSelectedQuizMeta(data.quiz || null);
    setResults(Array.isArray(data.attempts) ? data.attempts : []);
  };

  const loadQuestionSet = async (id: number) => {
    const data = await apiService
      .get<{ quiz?: any; questions?: any[] }>(`/student/teacher-quizzes/${id}/questions`)
      .catch(() => ({ questions: [], quiz: null }));
    setSelectedQuizMeta(data.quiz || null);
    setQuestionSet(Array.isArray(data.questions) ? data.questions : []);
  };

  const resetComposer = () => {
    setTitle('');
    setDueDate('');
    setCustomQuestions([]);
    setSelectedBankIds([]);
    setEditingQuizId(null);
    setPublishMode(false);
  };

  const saveDraft = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !classId || !subject) {
      toast({ title: 'Title, class, and subject are required', variant: 'destructive' });
      return;
    }
    if (teacherApiUser && !availableClasses.some((c) => String(c.id) === String(classId))) {
      toast({ title: 'Class not allowed', description: 'Pick a class assigned to you.', variant: 'destructive' });
      return;
    }
    const customPayload = customQuestions.filter(isCustomValid).map(customToPayload);
    if (selectedBankIds.length === 0 && customPayload.length === 0) {
      toast({ title: 'Add questions', description: 'Pick items from your bank and/or add custom questions.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: trimmedTitle,
        class_id: Number(classId),
        subject,
        due_date: dueDate || null,
        is_published: false,
        bank_question_ids: selectedBankIds,
        questions: customPayload,
      };
      if (editingQuizId) {
        await apiService.put(`/student/teacher-quizzes/${editingQuizId}`, body);
        toast({ title: 'Draft saved', description: 'You can publish when you are ready.' });
      } else {
        const res = await apiService.post<{ id?: number }>('/student/teacher-quizzes', body);
        const newId = Number(res?.id);
        if (Number.isFinite(newId)) setEditingQuizId(newId);
        toast({ title: 'Draft saved', description: 'Open “Review & publish” when you want parents to see it.' });
      }
      await loadQuizzes();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openPublishPanel = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !classId || !subject) {
      toast({ title: 'Complete details first', description: 'Title, class, and subject are required.', variant: 'destructive' });
      return;
    }
    const customPayload = customQuestions.filter(isCustomValid).map(customToPayload);
    if (selectedBankIds.length === 0 && customPayload.length === 0) {
      toast({ title: 'No questions', description: 'Add questions before publishing.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let qid = editingQuizId;
      const body = {
        title: trimmedTitle,
        class_id: Number(classId),
        subject,
        due_date: dueDate || null,
        is_published: false,
        bank_question_ids: selectedBankIds,
        questions: customPayload,
      };
      if (qid) await apiService.put(`/student/teacher-quizzes/${qid}`, body);
      else {
        const res = await apiService.post<{ id?: number }>('/student/teacher-quizzes', body);
        qid = Number(res?.id);
        if (Number.isFinite(qid)) setEditingQuizId(qid);
      }
      await loadQuizzes();
      if (!Number.isFinite(Number(qid))) throw new Error('Could not save draft before publishing.');
      setPublishMode(true);
    } catch (e: any) {
      toast({ title: 'Could not prepare publish', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const confirmPublish = async () => {
    const qid = editingQuizId;
    if (!qid) return;
    setPublishing(true);
    try {
      await apiService.post(`/student/teacher-quizzes/${qid}/publish`, {
        title: title.trim(),
        class_id: Number(classId),
        subject,
        due_date: dueDate || null,
      });
      toast({ title: 'Published', description: 'Parents can now see this online assessment.' });
      setPublishMode(false);
      resetComposer();
      await loadQuizzes();
    } catch (e: any) {
      toast({ title: 'Publish failed', description: e?.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const saveBankQuestion = async (opts?: { addAnother?: boolean }) => {
    const sub = (newBank.subject.trim() || subject).trim();
    if (!sub) {
      toast({ title: 'Subject required', variant: 'destructive' });
      return;
    }
    const itemTitle = newBank.itemTitle.trim() || undefined;
    const payload = {
      subject: sub,
      item_title: itemTitle,
      question_type: newBank.questionType,
      question_text: newBank.questionText.trim(),
      option_a: newBank.questionType === 'true_false' ? 'True' : newBank.optionA.trim(),
      option_b: newBank.questionType === 'true_false' ? 'False' : newBank.optionB.trim(),
      option_c: newBank.questionType === 'true_false' ? '' : newBank.optionC.trim(),
      option_d: newBank.questionType === 'true_false' ? '' : newBank.optionD.trim(),
      correct_option: newBank.correctOption,
      marks: Math.max(1, Number(newBank.marks || '1')),
    };
    if (!payload.question_text) {
      toast({ title: 'Enter the question', variant: 'destructive' });
      return;
    }
    if (newBank.questionType === 'mcq' && (!payload.option_a || !payload.option_b || !payload.option_c || !payload.option_d)) {
      toast({ title: 'All four options required for multiple choice', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiService.post('/student/question-bank', payload);
      toast({
        title: 'Saved to question bank',
        description: opts?.addAnother ? 'Add your next question below.' : undefined,
      });
      const keepSubject = normalizeTeacherSubjectKey(sub);
      const keepType = newBank.questionType;
      const keepItemTitle = opts?.addAnother ? newBank.itemTitle.trim() : '';
      setNewBank({
        subject: keepSubject,
        itemTitle: keepItemTitle,
        questionType: keepType,
        questionText: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctOption: keepType === 'true_false' ? 'a' : 'a',
        marks: '1',
      });
      await loadBank({ allSubjects: true });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteBankItem = async (id: number) => {
    if (!window.confirm('Remove this question from your bank?')) return;
    try {
      await apiService.delete(`/student/question-bank/${id}`);
      toast({ title: 'Removed' });
      setSelectedBankIds((prev) => prev.filter((x) => x !== id));
      await loadBank({ allSubjects: true });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    }
  };

  const startEditQuiz = async (quizId: number, opts?: { openPublish?: boolean }) => {
    const data = await apiService
      .get<{ quiz?: any; questions?: any[] }>(`/student/teacher-quizzes/${quizId}/questions`)
      .catch(() => ({ quiz: null, questions: [] }));
    if (!data.quiz) {
      toast({ title: 'Assessment not found', variant: 'destructive' });
      return;
    }
    setEditingQuizId(quizId);
    setTitle(String(data.quiz.title || ''));
    setClassId(String(data.quiz.class_id || ''));
    setSubject(normalizeTeacherSubjectKey(String(data.quiz.subject || '')));
    setDueDate(data.quiz.due_date ? String(data.quiz.due_date).slice(0, 10) : '');
    setPublishMode(!!opts?.openPublish);
    const drafts: DraftQuestion[] = [];
    for (const q of Array.isArray(data.questions) ? data.questions : []) {
      const qt = q.questionType === 'true_false' ? 'true_false' : 'mcq';
      const looksTf =
        qt === 'true_false' ||
        (String(q.options?.c || '').trim() === '' && String(q.options?.d || '').trim() === '' &&
          ['True', 'true'].includes(String(q.options?.a || '')) && ['False', 'false'].includes(String(q.options?.b || '')));
      if (looksTf) {
        drafts.push({
          questionType: 'true_false',
          questionText: String(q.questionText || ''),
          optionA: 'True',
          optionB: 'False',
          optionC: '',
          optionD: '',
          correctOption: (String(q.correctOption || 'a').toLowerCase() as 'a' | 'b'),
          marks: String(Math.max(1, Number(q.marks || 1))),
        });
      } else {
        drafts.push({
          questionType: 'mcq',
          questionText: String(q.questionText || ''),
          optionA: String(q.options?.a || ''),
          optionB: String(q.options?.b || ''),
          optionC: String(q.options?.c || ''),
          optionD: String(q.options?.d || ''),
          correctOption: (String(q.correctOption || 'a').toLowerCase() as 'a' | 'b' | 'c' | 'd'),
          marks: String(Math.max(1, Number(q.marks || 1))),
        });
      }
    }
    setCustomQuestions(drafts.length ? drafts : []);
    setSelectedBankIds([]);
    setMainTab('assessments');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const optionLetters = (q: any) => {
    const isTf = q.questionType === 'true_false';
    if (isTf) return (['a', 'b'] as const);
    return (['a', 'b', 'c', 'd'] as const).filter((k) => String(q.options?.[k] ?? '').trim().length > 0);
  };

  return (
    <div className="px-4 py-5 sm:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {selectedQuizId ? (
        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedQuizId(null);
                  setSelectedQuizMeta(null);
                  setResults([]);
                  setQuestionSet([]);
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant={selectedView === 'results' ? 'default' : 'outline'} onClick={() => setSelectedView('results')}>
                  Scores
                </Button>
                <Button type="button" variant={selectedView === 'questions' ? 'default' : 'outline'} onClick={() => setSelectedView('questions')}>
                  Questions
                </Button>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{selectedQuizMeta?.title || 'Assessment'}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {teacherSubjectDisplayLabel(selectedQuizMeta?.subject) || selectedQuizMeta?.subject || ''} · {selectedQuizMeta?.class_name || ''}
                </p>
              </CardHeader>
              <CardContent>
                {selectedView === 'results' ? (
                  results.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No completions yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold">Student</th>
                            <th className="text-left px-3 py-2 font-semibold">ID</th>
                            <th className="text-center px-3 py-2 font-semibold">Correct</th>
                            <th className="text-center px-3 py-2 font-semibold">Wrong</th>
                            <th className="text-center px-3 py-2 font-semibold">Score</th>
                            <th className="text-left px-3 py-2 font-semibold">Completed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r, i) => (
                            <tr key={`${r.student_id}-${i}`} className="border-t">
                              <td className="px-3 py-2">
                                {r.first_name} {r.last_name}
                              </td>
                              <td className="px-3 py-2">{r.admission_number}</td>
                              <td className="px-3 py-2 text-center">{r.correct_answers ?? '-'}</td>
                              <td className="px-3 py-2 text-center">{r.wrong_answers ?? '-'}</td>
                              <td className="px-3 py-2 text-center font-semibold">
                                {r.score}/{r.total_marks || r.total_questions}
                              </td>
                              <td className="px-3 py-2">{new Date(r.completed_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    {questionSet.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No questions.</p>
                    ) : (
                      questionSet.map((q) => (
                        <div key={q.id} className="rounded-xl border p-3 space-y-2 bg-card/50">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                              Q{q.index}
                            </Badge>
                            {q.questionType === 'true_false' ? (
                              <Badge className="bg-violet-600 hover:bg-violet-600">True / False</Badge>
                            ) : (
                              <Badge variant="outline">Multiple choice</Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">{q.marks || 1} marks</span>
                          </div>
                          <p className="text-sm font-semibold leading-relaxed">{q.questionText}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            {optionLetters(q).map((opt) => (
                              <div
                                key={opt}
                                className={`rounded-md border px-2 py-1.5 ${
                                  q.correctOption === opt ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40' : 'bg-muted/30'
                                }`}
                              >
                                <span className="uppercase font-semibold mr-1">{opt}.</span>
                                {q.options?.[opt]}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Answer: {String(q.correctOption || '').toUpperCase()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'bank' | 'assessments')} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-11">
            <TabsTrigger value="assessments" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Online assessments
            </TabsTrigger>
            <TabsTrigger value="bank" className="gap-2">
              <BookMarked className="h-4 w-4" />
              Question bank
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bank" className="space-y-6 mt-2">
            <Card className="overflow-hidden border-border/80 shadow-md">
              <CardHeader className="border-b bg-gradient-to-r from-violet-600/10 via-background to-sky-600/10">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers className="h-5 w-5 text-violet-600" />
                  Build your reusable library
                </CardTitle>
                <CardDescription>
                  Save multiple-choice or True/False items here, then reuse them when you assemble an assessment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5 min-w-[180px]">
                    <Label>Filter by subject</Label>
                    <Select value={bankSubjectFilter} onValueChange={setBankSubjectFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All subjects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All subjects</SelectItem>
                        {availableSubjects.map((s) => (
                          <SelectItem key={s} value={normalizeTeacherSubjectKey(s)}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => loadBank()} disabled={bankLoading}>
                    {bankLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                  </Button>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4 space-y-4">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="h-4 w-4" /> New bank question
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Subject</Label>
                      <Select
                        value={newBank.subject || subject || undefined}
                        onValueChange={(v) => setNewBank((p) => ({ ...p, subject: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSubjects.map((s) => (
                            <SelectItem key={s} value={normalizeTeacherSubjectKey(s)}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select
                        value={newBank.questionType}
                        onValueChange={(v) =>
                          setNewBank((p) => ({
                            ...p,
                            questionType: v as QuestionKind,
                            correctOption: v === 'true_false' ? 'a' : p.correctOption,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple choice (A–D)</SelectItem>
                          <SelectItem value="true_false">True / False</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>Short title / topic (optional)</Label>
                      {title.trim() ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-violet-600 hover:underline"
                          onClick={() => setNewBank((p) => ({ ...p, itemTitle: title.trim() }))}
                        >
                          Use assessment title
                        </button>
                      ) : null}
                    </div>
                    <Input
                      value={newBank.itemTitle}
                      onChange={(e) => setNewBank((p) => ({ ...p, itemTitle: e.target.value }))}
                      placeholder="e.g. Algebra — Week 4 (shown when picking questions for an assessment)"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Question</Label>
                    <Input
                      value={newBank.questionText}
                      onChange={(e) => setNewBank((p) => ({ ...p, questionText: e.target.value }))}
                      placeholder="Enter the question stem…"
                    />
                  </div>
                  {newBank.questionType === 'mcq' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input value={newBank.optionA} onChange={(e) => setNewBank((p) => ({ ...p, optionA: e.target.value }))} placeholder="Option A" />
                      <Input value={newBank.optionB} onChange={(e) => setNewBank((p) => ({ ...p, optionB: e.target.value }))} placeholder="Option B" />
                      <Input value={newBank.optionC} onChange={(e) => setNewBank((p) => ({ ...p, optionC: e.target.value }))} placeholder="Option C" />
                      <Input value={newBank.optionD} onChange={(e) => setNewBank((p) => ({ ...p, optionD: e.target.value }))} placeholder="Option D" />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground rounded-lg bg-background/80 border px-3 py-2">
                      Learners will see <strong>True</strong> and <strong>False</strong> as the two choices.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="space-y-1.5">
                      <Label>Correct answer</Label>
                      <Select
                        value={newBank.correctOption}
                        onValueChange={(v) => setNewBank((p) => ({ ...p, correctOption: v as any }))}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {newBank.questionType === 'true_false' ? (
                            <>
                              <SelectItem value="a">True</SelectItem>
                              <SelectItem value="b">False</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="a">A</SelectItem>
                              <SelectItem value="b">B</SelectItem>
                              <SelectItem value="c">C</SelectItem>
                              <SelectItem value="d">D</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Marks</Label>
                      <Input
                        className="w-24"
                        type="number"
                        min={1}
                        value={newBank.marks}
                        onChange={(e) => setNewBank((p) => ({ ...p, marks: e.target.value }))}
                      />
                    </div>
                    <Button type="button" className="mt-6 bg-violet-600 hover:bg-violet-700" onClick={() => saveBankQuestion()} disabled={saving}>
                      Save to bank
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-6 border-violet-300"
                      onClick={() => saveBankQuestion({ addAnother: true })}
                      disabled={saving}
                    >
                      Save &amp; add another
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Saved items ({bankItems.length})</p>
                  {bankItems.length === 0 && !bankLoading && (
                    <p className="text-sm text-muted-foreground py-6 text-center border rounded-xl border-dashed">
                      No questions yet. Add your first one above.
                    </p>
                  )}
                  <div className="grid gap-3">
                    {bankItems.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start gap-3 bg-card shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{teacherSubjectDisplayLabel(b.subject)}</Badge>
                            {b.questionType === 'true_false' ? (
                              <Badge className="bg-violet-600">T / F</Badge>
                            ) : (
                              <Badge variant="secondary">MCQ</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{b.marks} marks</span>
                          </div>
                          <p className="text-sm font-medium leading-relaxed">
                            {b.itemTitle ? <span className="block text-xs font-semibold text-violet-700 mb-1">{b.itemTitle}</span> : null}
                            {b.questionText}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => deleteBankItem(b.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assessments" className="space-y-6 mt-2">
            {publishMode && editingQuizId ? (
              <Card className="overflow-hidden border-0 shadow-xl ring-1 ring-violet-500/20 bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 text-white">
                <CardHeader className="space-y-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 text-violet-200 text-xs font-semibold uppercase tracking-widest">
                    <Rocket className="h-4 w-4" /> Ready to publish
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight text-white">Review online assessment</CardTitle>
                  <CardDescription className="text-violet-100/90">
                    Parents and students only see published assessments. Confirm details below, then publish.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
                      <p className="text-xs text-violet-200 uppercase tracking-wide">Title</p>
                      <p className="text-lg font-semibold">{title.trim() || '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
                      <p className="text-xs text-violet-200 uppercase tracking-wide">Class & subject</p>
                      <p className="text-lg font-semibold">
                        {availableClasses.find((c) => String(c.id) === String(classId))?.className || 'Class'} · {teacherSubjectDisplayLabel(subject) || subject}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
                      <p className="text-xs text-violet-200 uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Due date
                      </p>
                      <p className="text-lg font-semibold">{dueDate || 'No due date'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
                      <p className="text-xs text-violet-200 uppercase tracking-wide flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" /> Questions & marks
                      </p>
                      <p className="text-lg font-semibold">
                        {questionCountPreview} questions · {totalMarksPreview} marks total
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="bg-white/15 text-white border border-white/20 hover:bg-white/25"
                      onClick={() => setPublishMode(false)}
                      disabled={publishing}
                    >
                      Back to editor
                    </Button>
                    <Button type="button" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white shadow-lg" onClick={confirmPublish} disabled={publishing}>
                      {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Publish now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {!publishMode && (
              <>
                <Card className="overflow-hidden border-border/80 shadow-md">
                  <CardHeader className="border-b bg-gradient-to-r from-sky-600/10 via-background to-violet-600/10">
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-sky-600" />
                      {editingQuizId ? `Edit assessment #${editingQuizId}` : 'New online assessment'}
                    </CardTitle>
                    <CardDescription>
                      Select saved bank questions and/or write custom items. Save a draft anytime, then publish when you are ready.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    {editingQuizId && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 dark:bg-sky-950/30 px-3 py-2 text-sm">
                        <span>Draft or published — use Save draft or Review & publish.</span>
                        <Button type="button" size="sm" variant="outline" onClick={resetComposer}>
                          New assessment
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assessment title" />
                      <Select value={classId || undefined} onValueChange={setClassId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Class" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableClasses.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.className}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={subject || undefined} onValueChange={setSubject}>
                        <SelectTrigger>
                          <SelectValue placeholder="Subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSubjects.map((s) => (
                            <SelectItem key={s} value={normalizeTeacherSubjectKey(s)}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>

                    {teacherApiUser && availableClasses.length === 0 && (
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        You are not assigned to any class yet. Ask admin to assign your class.
                      </p>
                    )}

                    <div className="rounded-2xl border bg-muted/15 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold flex items-center gap-2">
                          <BookMarked className="h-4 w-4" /> From question bank ({bankFilteredForComposer.length} for this subject)
                        </p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => loadBank({ allSubjects: true })}>
                          Refresh bank
                        </Button>
                      </div>
                        <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-2 py-1.5">
                          Showing bank items for <strong>{teacherSubjectDisplayLabel(subject) || subject}</strong> — add questions under the same subject in the Question bank tab so they appear here.
                        </p>
                        {bankFilteredForComposer.length === 0 ? (
                          <p className="text-xs text-muted-foreground border border-dashed rounded-lg px-3 py-4 text-center">
                            No bank items for this subject yet. Open the Question bank tab, choose this subject, and use &quot;Save &amp; add another&quot; to add several questions in a row.
                          </p>
                        ) : (
                          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                            {bankFilteredForComposer.map((b) => (
                              <label
                                key={b.id}
                                className="flex items-start gap-3 rounded-xl border bg-background/80 px-3 py-2 cursor-pointer hover:bg-accent/40"
                              >
                                <Checkbox checked={selectedBankIds.includes(b.id)} onCheckedChange={() => toggleBankId(b.id)} className="mt-1" />
                                <span className="text-sm flex-1 min-w-0">
                                  {b.itemTitle ? (
                                    <span className="block text-xs font-semibold text-violet-700 mb-0.5">{b.itemTitle}</span>
                                  ) : null}
                                  <span className="font-medium line-clamp-2">{b.questionText}</span>
                                  <span className="block text-xs text-muted-foreground mt-0.5">
                                    {b.questionType === 'true_false' ? 'True/False' : 'MCQ'} · {b.marks} marks
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Custom questions (optional)</p>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setCustomQuestions((p) => [...p, emptyCustom('mcq')])}>
                            + MCQ
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setCustomQuestions((p) => [...p, emptyCustom('true_false')])}>
                            + True/False
                          </Button>
                        </div>
                      </div>
                      {customQuestions.map((q, i) => (
                        <div key={i} className="rounded-xl border p-3 space-y-2 bg-card/60">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline">{q.questionType === 'true_false' ? 'True / False' : 'MCQ'}</Badge>
                            <Button type="button" variant="ghost" size="sm" className="text-destructive h-8" onClick={() => setCustomQuestions((p) => p.filter((_, j) => j !== i))}>
                              Remove
                            </Button>
                          </div>
                          <Input
                            value={q.questionText}
                            onChange={(e) => setCustomQuestions((p) => p.map((x, j) => (j === i ? { ...x, questionText: e.target.value } : x)))}
                            placeholder="Question text"
                          />
                          {q.questionType === 'mcq' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Input value={q.optionA} onChange={(e) => setCustomQuestions((p) => p.map((x, j) => (j === i ? { ...x, optionA: e.target.value } : x)))} placeholder="A" />
                              <Input value={q.optionB} onChange={(e) => setCustomQuestions((p) => p.map((x, j) => (j === i ? { ...x, optionB: e.target.value } : x)))} placeholder="B" />
                              <Input value={q.optionC} onChange={(e) => setCustomQuestions((p) => p.map((x, j) => (j === i ? { ...x, optionC: e.target.value } : x)))} placeholder="C" />
                              <Input value={q.optionD} onChange={(e) => setCustomQuestions((p) => p.map((x, j) => (j === i ? { ...x, optionD: e.target.value } : x)))} placeholder="D" />
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-2 items-center">
                            <Select value={q.correctOption} onValueChange={(v) => setCustomQuestions((p) => p.map((x, j) => (j === i ? { ...x, correctOption: v as any } : x)))}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Correct" />
                              </SelectTrigger>
                              <SelectContent>
                                {q.questionType === 'true_false' ? (
                                  <>
                                    <SelectItem value="a">True</SelectItem>
                                    <SelectItem value="b">False</SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="a">A</SelectItem>
                                    <SelectItem value="b">B</SelectItem>
                                    <SelectItem value="c">C</SelectItem>
                                    <SelectItem value="d">D</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                            <Input
                              className="w-24"
                              type="number"
                              min={1}
                              value={q.marks}
                              onChange={(e) => setCustomQuestions((p) => p.map((x, j) => (j === i ? { ...x, marks: e.target.value } : x)))}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button type="button" variant="outline" onClick={saveDraft} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save draft
                      </Button>
                      <Button type="button" onClick={openPublishPanel} disabled={saving} className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600">
                        <Rocket className="h-4 w-4" />
                        Review & publish
                      </Button>
                      <span className="text-xs text-muted-foreground self-center ml-auto">
                        {questionCountPreview} questions · {totalMarksPreview} marks
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Your assessments</CardTitle>
                    <CardDescription>Drafts stay private until you publish.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {quizzes.map((q) => (
                      <div
                        key={q.id}
                        className="rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card/50"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold truncate">{q.title}</p>
                            {q.is_published === false || q.is_published === 'f' ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                Draft
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600">Published</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {teacherSubjectDisplayLabel(q.subject) || q.subject} · {q.class_name || `Class ${q.class_id}`} · {q.submissions || 0} submissions
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {q.is_published === false || q.is_published === 'f' ? (
                            <>
                              <Button type="button" size="sm" variant="default" onClick={() => startEditQuiz(Number(q.id), { openPublish: true })}>
                                Publish…
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => startEditQuiz(Number(q.id))}>
                                Edit
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedQuizId(q.id);
                                  setSelectedView('results');
                                  loadResults(q.id).catch(() => undefined);
                                  loadQuestionSet(q.id).catch(() => undefined);
                                }}
                              >
                                Scores
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedQuizId(q.id);
                                  setSelectedView('questions');
                                  loadQuestionSet(q.id).catch(() => undefined);
                                  loadResults(q.id).catch(() => undefined);
                                }}
                              >
                                Questions
                              </Button>
                              <Button type="button" size="sm" onClick={() => startEditQuiz(Number(q.id))}>
                                Edit
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {!quizzes.length && <p className="text-sm text-muted-foreground">No assessments yet.</p>}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default TeacherQuizModule;

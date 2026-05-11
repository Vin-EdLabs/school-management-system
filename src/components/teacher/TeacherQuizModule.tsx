import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchool } from '../../contexts/SchoolContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

type DraftQuestion = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'a' | 'b' | 'c' | 'd';
  marks: string;
};

const emptyQ = (): DraftQuestion => ({
  questionText: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctOption: 'a',
  marks: '1',
});

const TeacherQuizModule = () => {
  const { schoolId } = useSchool();
  const { user } = useAuth();
  const { classes, subjects } = useData();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [classId, setClassId] = useState('');
  const [saving, setSaving] = useState(false);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [selectedQuizMeta, setSelectedQuizMeta] = useState<any | null>(null);
  const [selectedView, setSelectedView] = useState<'results' | 'questions'>('results');
  const [results, setResults] = useState<any[]>([]);
  const [questionSet, setQuestionSet] = useState<any[]>([]);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQ(), emptyQ()]);
  const [teacherClasses, setTeacherClasses] = useState<Array<{ id: number; class_name: string }>>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);

  const teacherApiUser = useMemo(
    () => !!(user && (user.role === 'teacher' || (user.role === 'staff' && user.teacherId))),
    [user]
  );

  const loadQuizzes = async () => {
    const data = await apiService.get<{ quizzes?: any[] }>('/student/teacher-quizzes/my').catch(() => ({ quizzes: [] }));
    setQuizzes(Array.isArray(data.quizzes) ? data.quizzes : []);
  };

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
    loadQuizzes().catch(() => undefined);
    if (teacherApiUser) {
      apiService.get<Array<{ id: number; class_name: string }>>('/teachers/me/classes')
        .then((r) => setTeacherClasses(Array.isArray(r) ? r : []))
        .catch(() => setTeacherClasses([]));
      apiService.get<{ subjects_taught?: string[] }>('/teachers/me')
        .then((r) => setTeacherSubjects(Array.isArray(r?.subjects_taught) ? r.subjects_taught : []))
        .catch(() => setTeacherSubjects([]));
    } else {
      setTeacherClasses([]);
      setTeacherSubjects([]);
    }
  }, [schoolId, teacherApiUser]);

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
    if (!availableSubjects.includes(subject)) setSubject(availableSubjects[0]);
  }, [availableSubjects, subject]);

  const loadResults = async (id: number) => {
    const data = await apiService.get<{ quiz?: any; attempts?: any[] }>(`/student/teacher-quizzes/${id}/results`).catch(() => ({ attempts: [], quiz: null }));
    setSelectedQuizMeta(data.quiz || null);
    setResults(Array.isArray(data.attempts) ? data.attempts : []);
  };

  const loadQuestionSet = async (id: number) => {
    const data = await apiService.get<{ quiz?: any; questions?: any[] }>(`/student/teacher-quizzes/${id}/questions`).catch(() => ({ questions: [], quiz: null }));
    setSelectedQuizMeta(data.quiz || null);
    setQuestionSet(Array.isArray(data.questions) ? data.questions : []);
  };

  const publish = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !classId || !subject) {
      toast({ title: 'Title, class and subject are required', variant: 'destructive' });
      return;
    }
    if (teacherApiUser && !availableClasses.some((c) => String(c.id) === String(classId))) {
      toast({
        title: 'Class assignment required',
        description: 'You can only publish quizzes for classes assigned to you.',
        variant: 'destructive',
      });
      return;
    }
    if (availableSubjects.length === 0) {
      toast({ title: 'No available subjects for this teacher', description: 'Ask admin to create subjects and assign subjects to your profile.', variant: 'destructive' });
      return;
    }
    const validQuestions = questions
      .map((q) => ({
        question_text: q.questionText.trim(),
        option_a: q.optionA.trim(),
        option_b: q.optionB.trim(),
        option_c: q.optionC.trim(),
        option_d: q.optionD.trim(),
        correct_option: q.correctOption,
        marks: Math.max(1, Number(q.marks || '1')),
      }))
      .filter((q) => q.question_text && q.option_a && q.option_b && q.option_c && q.option_d);
    if (validQuestions.length < 1) {
      toast({ title: 'Add at least 1 complete question', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: trimmedTitle,
        class_id: Number(classId),
        subject,
        due_date: dueDate || null,
        questions: validQuestions,
      };
      if (editingQuizId) {
        await apiService.put(`/student/teacher-quizzes/${editingQuizId}`, payload);
        toast({ title: 'Quiz updated successfully' });
      } else {
        await apiService.post('/student/teacher-quizzes', payload);
        toast({ title: 'Quiz published successfully' });
      }
      setTitle('');
      setDueDate('');
      setQuestions([emptyQ(), emptyQ()]);
      setEditingQuizId(null);
      await loadQuizzes();
    } catch (e: any) {
      toast({ title: editingQuizId ? 'Update failed' : 'Publish failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const startEditQuiz = async (quizId: number) => {
    const data = await apiService.get<{ quiz?: any; questions?: any[] }>(`/student/teacher-quizzes/${quizId}/questions`).catch(() => ({ quiz: null, questions: [] }));
    if (!data.quiz) {
      toast({ title: 'Quiz not found', variant: 'destructive' });
      return;
    }
    setEditingQuizId(quizId);
    setTitle(String(data.quiz.title || ''));
    setClassId(String(data.quiz.class_id || ''));
    setSubject(String(data.quiz.subject || ''));
    setDueDate(data.quiz.due_date ? String(data.quiz.due_date).slice(0, 10) : '');
    const draft = (Array.isArray(data.questions) ? data.questions : []).map((q: any) => ({
      questionText: String(q.questionText || ''),
      optionA: String(q.options?.a || ''),
      optionB: String(q.options?.b || ''),
      optionC: String(q.options?.c || ''),
      optionD: String(q.options?.d || ''),
      correctOption: (String(q.correctOption || 'a').toLowerCase() as 'a' | 'b' | 'c' | 'd'),
      marks: String(Math.max(1, Number(q.marks || 1))),
    }));
    setQuestions(draft.length ? draft : [emptyQ()]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="px-4 py-5 sm:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {selectedQuizId ? (
        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => { setSelectedQuizId(null); setSelectedQuizMeta(null); setResults([]); setQuestionSet([]); }}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to quizzes
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant={selectedView === 'results' ? 'default' : 'outline'} onClick={() => setSelectedView('results')}>
                  View Scores
                </Button>
                <Button type="button" variant={selectedView === 'questions' ? 'default' : 'outline'} onClick={() => setSelectedView('questions')}>
                  Question Set
                </Button>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{selectedQuizMeta?.title || (selectedView === 'questions' ? 'Question Set' : 'Quiz Results')}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {(selectedQuizMeta?.subject || '').toUpperCase()} · {selectedQuizMeta?.class_name || ''}
                </p>
              </CardHeader>
              <CardContent>
                {selectedView === 'results' ? (
                  results.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No student has completed this quiz yet.</p>
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
                              <td className="px-3 py-2">{r.first_name} {r.last_name}</td>
                              <td className="px-3 py-2">{r.admission_number}</td>
                              <td className="px-3 py-2 text-center">{r.correct_answers ?? '-'}</td>
                              <td className="px-3 py-2 text-center">{r.wrong_answers ?? '-'}</td>
                              <td className="px-3 py-2 text-center font-semibold">{r.score}/{r.total_marks || r.total_questions}</td>
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
                      <p className="text-sm text-muted-foreground">No questions found for this quiz.</p>
                    ) : questionSet.map((q) => (
                      <div key={q.id} className="rounded-xl border p-3 space-y-2">
                        <p className="text-sm font-semibold">Q{q.index}. {q.questionText}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {(['a', 'b', 'c', 'd'] as const).map((opt) => (
                            <div key={opt} className={`rounded-md border px-2 py-1.5 ${q.correctOption === opt ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/30'}`}>
                              <span className="uppercase font-semibold mr-1">{opt}.</span>
                              {q.options?.[opt]}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Correct: {String(q.correctOption || '').toUpperCase()} · Marks: {q.marks || 1}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      ) : (
        <>
      <Card>
        <CardHeader>
          <CardTitle>{editingQuizId ? 'Edit Learning Quiz' : 'Learning Quizzes'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingQuizId && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm flex items-center justify-between">
              <span>Editing published quiz #{editingQuizId}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingQuizId(null);
                  setTitle('');
                  setDueDate('');
                  setQuestions([emptyQ(), emptyQ()]);
                }}
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-b pb-3 mb-1 -mt-1 sm:sticky sm:top-0 sm:z-10 sm:bg-card sm:-mx-1 sm:px-1 sm:pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-manipulation border-2 border-indigo-600 text-indigo-900 bg-white hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-100 dark:bg-slate-900 dark:hover:bg-slate-800 font-semibold"
              onClick={() => setQuestions((prev) => [...prev, emptyQ()])}
            >
              Add Question
            </Button>
            <Button
              type="button"
              size="sm"
              className="touch-manipulation bg-indigo-600 hover:bg-indigo-700 text-white font-semibold border-2 border-indigo-700 shadow-sm disabled:opacity-60"
              onClick={publish}
              disabled={saving}
            >
              {saving ? (editingQuizId ? 'Saving…' : 'Publishing…') : (editingQuizId ? 'Save Changes' : 'Publish Quiz')}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title" />
            <Select value={classId || undefined} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                {availableClasses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.className}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subject || undefined} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                {availableSubjects.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          {teacherApiUser && availableClasses.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              You are not assigned to any class yet. Ask admin to assign your class before posting quizzes.
            </p>
          )}
          {createdSubjects.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No subjects exist for this school yet. Ask an administrator to create subjects first.
            </p>
          )}

          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl border p-3 space-y-2">
                <Input
                  value={q.questionText}
                  onChange={(e) => setQuestions((prev) => prev.map((x, idx) => idx === i ? { ...x, questionText: e.target.value } : x))}
                  placeholder={`Question ${i + 1}`}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input value={q.optionA} onChange={(e) => setQuestions((prev) => prev.map((x, idx) => idx === i ? { ...x, optionA: e.target.value } : x))} placeholder="Option A" />
                  <Input value={q.optionB} onChange={(e) => setQuestions((prev) => prev.map((x, idx) => idx === i ? { ...x, optionB: e.target.value } : x))} placeholder="Option B" />
                  <Input value={q.optionC} onChange={(e) => setQuestions((prev) => prev.map((x, idx) => idx === i ? { ...x, optionC: e.target.value } : x))} placeholder="Option C" />
                  <Input value={q.optionD} onChange={(e) => setQuestions((prev) => prev.map((x, idx) => idx === i ? { ...x, optionD: e.target.value } : x))} placeholder="Option D" />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={q.correctOption} onValueChange={(v) => setQuestions((prev) => prev.map((x, idx) => idx === i ? { ...x, correctOption: v as any } : x))}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a">Correct: A</SelectItem>
                      <SelectItem value="b">Correct: B</SelectItem>
                      <SelectItem value="c">Correct: C</SelectItem>
                      <SelectItem value="d">Correct: D</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-[130px]"
                    type="number"
                    min={1}
                    value={q.marks}
                    onChange={(e) => setQuestions((prev) => prev.map((x, idx) => idx === i ? { ...x, marks: e.target.value } : x))}
                    placeholder="Marks"
                  />
                </div>
              </div>
            ))}
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published Quizzes & Scores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quizzes.map((q) => (
            <div key={q.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{q.title}</p>
                <p className="text-xs text-muted-foreground">{q.subject?.toUpperCase()} · {q.class_name || `Class ${q.class_id}`} · {q.submissions || 0} submissions</p>
              </div>
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
                View Scores
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => startEditQuiz(Number(q.id))}
              >
                Edit Quiz
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
                View Questions
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
};

export default TeacherQuizModule;

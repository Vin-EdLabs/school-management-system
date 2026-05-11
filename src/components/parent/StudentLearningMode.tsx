import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Flame, ChevronRight, Trophy, Sparkles, CheckCircle2, XCircle, Star } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

type StudentInfo = {
  id?: number;
  first_name: string;
  last_name: string;
  class_name?: string | null;
  class_assigned_id?: number | null;
  current_term?: string | null;
};

type SubjectKey = 'maths' | 'science' | 'english' | 'social' | 'rme' | 'french' | 'ict';
type QuizQuestion = {
  id: number;
  questionText: string;
  options: { a: string; b: string; c: string; d: string };
  correctOption: 'a' | 'b' | 'c' | 'd';
  marks?: number;
};

type RecentSession = {
  id: number;
  subject: string;
  source?: 'daily' | 'teacher';
  teacher_quiz_id?: number | null;
  total_questions: number;
  correct_answers: number;
  points_earned: number;
  completed_at: string;
};

const SUBJECTS: Array<{ key: SubjectKey; label: string; icon: string; color: string }> = [
  { key: 'maths', label: 'Mathematics', icon: '📐', color: 'from-blue-500 to-blue-600' },
  { key: 'science', label: 'Science', icon: '🔬', color: 'from-green-500 to-green-600' },
  { key: 'english', label: 'English', icon: '📖', color: 'from-purple-500 to-purple-600' },
  { key: 'social', label: 'Social', icon: '🌍', color: 'from-orange-500 to-orange-600' },
  { key: 'rme', label: 'RME', icon: '✝️', color: 'from-yellow-500 to-amber-600' },
  { key: 'french', label: 'French', icon: '🇫🇷', color: 'from-red-500 to-red-600' },
  { key: 'ict', label: 'ICT', icon: '💻', color: 'from-teal-500 to-teal-600' },
];

async function apiFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const starsForResult = (correct: number, total: number) => {
  if (total <= 0) return '☆☆☆☆☆';
  if (correct >= total) return '⭐⭐⭐⭐⭐';
  const filled = Math.max(0, Math.min(5, Math.round((correct / total) * 5)));
  return `${'⭐'.repeat(filled)}${'☆'.repeat(5 - filled)}`;
};

const labelForSubject = (subject: string) => SUBJECTS.find((s) => s.key === subject)?.label || subject;
const motivationBySubject: Record<SubjectKey, string> = {
  maths: 'Sharpen your brain',
  science: 'Discover how things work',
  english: 'Master communication',
  social: 'Understand your world',
  rme: 'Build strong values',
  french: 'Speak with confidence',
  ict: 'Create with technology',
};

const normalizeSubject = (subject: string): SubjectKey => {
  const x = subject.toLowerCase().trim();
  if (x === 'mathematics' || x === 'math') return 'maths';
  if (x === 'integrated science') return 'science';
  if (x === 'english language') return 'english';
  if ((['maths', 'science', 'english', 'social', 'rme', 'french', 'ict'] as string[]).includes(x)) return x as SubjectKey;
  return 'english';
};

function getClassLevelFromName(className?: string | null) {
  const x = String(className || '').toLowerCase();
  if (x.includes('jhs 1') || x.includes('jhs1')) return 'jhs1';
  if (x.includes('jhs 2') || x.includes('jhs2')) return 'jhs2';
  if (x.includes('jhs 3') || x.includes('jhs3')) return 'jhs3';
  return 'jhs1';
}

export default function StudentLearningMode({
  token,
  student,
  onExit,
  liveSignal,
}: {
  token: string;
  student: StudentInfo;
  onExit: () => void;
  liveSignal?: number;
}) {
  const [screen, setScreen] = useState<'home' | 'quiz' | 'review' | 'result' | 'leaderboard'>('home');
  const [stats, setStats] = useState<{ currentStreak: number; weeklyPoints: number; totalPoints: number; quizzesDoneWeek: number; accuracyWeek: number }>({
    currentStreak: 0,
    weeklyPoints: 0,
    totalPoints: 0,
    quizzesDoneWeek: 0,
    accuracyWeek: 0,
  });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [teacherQuizzes, setTeacherQuizzes] = useState<any[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [activeSubject, setActiveSubject] = useState<SubjectKey | null>(null);
  const [activeSource, setActiveSource] = useState<'daily' | 'teacher'>('daily');
  const [activeTeacherQuizId, setActiveTeacherQuizId] = useState<number | null>(null);
  const [activeQuizTitle, setActiveQuizTitle] = useState<string>('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<'a' | 'b' | 'c' | 'd' | null>(null);
  const [answers, setAnswers] = useState<Record<number, 'a' | 'b' | 'c' | 'd'>>({});
  const [score, setScore] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectKey[]>([]);

  const classLevel = useMemo(() => getClassLevelFromName(student.class_name), [student.class_name]);

  const loadHome = async () => {
    if (!student.class_assigned_id) return;
    const [statsRes, lbRes, tqRes, subjectRes, sessionsRes] = await Promise.all([
      apiFetch('/student/stats', token).catch(() => ({ currentStreak: 0, weeklyPoints: 0, totalPoints: 0, quizzesDoneWeek: 0, accuracyWeek: 0 })),
      apiFetch(`/student/leaderboard?class_id=${student.class_assigned_id}`, token).catch(() => ({ leaderboard: [], me: null })),
      apiFetch('/student/teacher-quizzes', token).catch(() => ({ quizzes: [] })),
      apiFetch('/student/subjects', token).catch(() => ({ subjects: [] })),
      apiFetch('/student/recent-sessions', token).catch(() => ({ sessions: [] })),
    ]);
    setStats({
      currentStreak: Number(statsRes.currentStreak || 0),
      weeklyPoints: Number(statsRes.weeklyPoints || 0),
      totalPoints: Number(statsRes.totalPoints || 0),
      quizzesDoneWeek: Number(statsRes.quizzesDoneWeek || 0),
      accuracyWeek: Number(statsRes.accuracyWeek || 0),
    });
    setLeaderboard(Array.isArray(lbRes.leaderboard) ? lbRes.leaderboard : []);
    setMyRank(lbRes?.me?.rank ?? null);
    const normalizedQuizzes = (Array.isArray(tqRes.quizzes) ? tqRes.quizzes : []).map((q: any) => ({
      ...q,
      completed: q?.completed === true || q?.completed === 'true' || q?.completed === 't' || q?.completed === 1,
    }));
    setTeacherQuizzes(normalizedQuizzes);
    const subjectKeys = (Array.isArray(subjectRes?.subjects) ? subjectRes.subjects : [])
      .map((s: string) => normalizeSubject(s))
      .filter((s: SubjectKey) => SUBJECTS.some((x) => x.key === s));
    setAvailableSubjects(subjectKeys);
    setRecentSessions(Array.isArray(sessionsRes.sessions) ? sessionsRes.sessions : []);
  };

  useEffect(() => {
    loadHome().catch(() => undefined);
  }, [token, student.class_assigned_id, liveSignal]);

  const startDailyQuiz = async (subject: SubjectKey) => {
    setLoading(true);
    try {
      const data = await apiFetch(
        `/student/questions?class=${classLevel}&subject=${subject}&term=1&count=5`,
        token
      );
      const list = Array.isArray(data.questions) ? data.questions : [];
      if (!list.length) throw new Error('No questions yet for this subject.');
      setActiveSource('daily');
      setActiveTeacherQuizId(null);
      setActiveSubject(subject);
      setActiveQuizTitle(labelForSubject(subject));
      setQuestions(list);
      setIdx(0);
      setScore(0);
      setSelected(null);
      setAnswers({});
      setScreen('quiz');
    } finally {
      setLoading(false);
    }
  };

  const startTeacherQuiz = async (quizId: number, subject: SubjectKey) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/student/teacher-quiz/${quizId}/questions`, token);
      const list = Array.isArray(data.questions) ? data.questions : [];
      if (!list.length) throw new Error('No questions found in this teacher quiz.');
      setActiveSource('teacher');
      setActiveTeacherQuizId(quizId);
      setActiveSubject(subject);
      setActiveQuizTitle(String(data?.quiz?.title || 'Teacher Quiz'));
      setQuestions(list);
      setIdx(0);
      setScore(0);
      setSelected(null);
      setAnswers({});
      setScreen('quiz');
    } finally {
      setLoading(false);
    }
  };

  const reviewTeacherQuiz = async (quizId: number, subject: SubjectKey, title?: string) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/student/teacher-quiz/${quizId}/questions`, token);
      const list = Array.isArray(data.questions) ? data.questions : [];
      if (!list.length) throw new Error('No questions found in this teacher quiz.');
      setActiveSource('teacher');
      setActiveTeacherQuizId(quizId);
      setActiveSubject(subject);
      setActiveQuizTitle(String(title || data?.quiz?.title || 'Teacher Quiz'));
      setQuestions(list);
      setIdx(0);
      setScore(0);
      setSelected(null);
      setAnswers({});
      setScreen('review');
    } finally {
      setLoading(false);
    }
  };

  const completeQuiz = async (finalCorrect: number) => {
    if (!activeSubject) return;
    const total = questions.length || 5;
    const res = await apiFetch('/student/quiz-complete', token, {
      method: 'POST',
      body: JSON.stringify({
        source: activeSource,
        teacher_quiz_id: activeTeacherQuizId,
        subject: activeSubject,
        total_questions: total,
        correct_answers: finalCorrect,
      }),
    }).catch(() => null);
    setPointsEarned(Number(res?.pointsEarned || (finalCorrect * 10 + 10 + (finalCorrect === total ? 20 : 0))));
    setScreen('result');
    await loadHome().catch(() => undefined);
  };

  const answer = (option: 'a' | 'b' | 'c' | 'd') => {
    if (!questions[idx]) return;
    setSelected(option);
    setAnswers((prev) => ({ ...prev, [idx]: option }));
  };

  const submitQuiz = async () => {
    const finalCorrect = questions.reduce((acc, qq, qIndex) => {
      return acc + (answers[qIndex] === qq.correctOption ? 1 : 0);
    }, 0);
    const totalMarks = questions.reduce((sum, qq) => sum + Number(qq.marks || 1), 0);
    const scoreMarks = questions.reduce((sum, qq, qIndex) => {
      return sum + (answers[qIndex] === qq.correctOption ? Number(qq.marks || 1) : 0);
    }, 0);
    setScore(finalCorrect);
    if (!activeSubject) return;
    const total = questions.length || 5;
    const res = await apiFetch('/student/quiz-complete', token, {
      method: 'POST',
      body: JSON.stringify({
        source: activeSource,
        teacher_quiz_id: activeTeacherQuizId,
        subject: activeSubject,
        total_questions: total,
        correct_answers: finalCorrect,
        wrong_answers: Math.max(0, total - finalCorrect),
        score: scoreMarks,
        total_marks: totalMarks,
      }),
    }).catch(() => null);
    setPointsEarned(Number(res?.pointsEarned || (finalCorrect * 10 + 10 + (finalCorrect === total ? 20 : 0))));
    setScreen('result');
    await loadHome().catch(() => undefined);
  };

  const meEntry = leaderboard.find((x) => x.isMe);
  const pointsToNext = myRank && myRank > 1 ? Math.max(0, (leaderboard[myRank - 2]?.points || 0) - (meEntry?.points || 0)) : 0;
  const weeklyPerformance = Math.min(100, Math.max(0, Math.round((stats.weeklyPoints / 300) * 100)));
  const pendingTeacherQuiz = teacherQuizzes.find((q) => !q.completed);
  const visibleTeacherQuizzes = teacherQuizzes.slice(0, 4);
  const q = questions[idx];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[radial-gradient(1200px_600px_at_0%_-10%,#e0e7ff_0%,#f8fafc_45%,#f8fafc_100%)] animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto min-h-screen p-4 sm:p-5 pb-24">
        <button onClick={onExit} className="sticky top-3 z-20 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3 bg-white/85 backdrop-blur border border-white/70 rounded-full px-3 py-1.5 shadow-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Parent
        </button>

        {screen === 'home' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
            <button
              type="button"
              onClick={() => setScreen('leaderboard')}
              className="w-full text-left rounded-[28px] border border-white/70 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-5 text-white shadow-[0_20px_45px_-20px_rgba(79,70,229,0.8)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold tracking-tight">Hi {student.first_name} 👋</p>
                  <p className="text-sm/5 text-indigo-100 mt-0.5">{student.class_name || classLevel.toUpperCase()}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold rounded-full bg-white/20 px-2.5 py-1">
                    <Flame className="w-4 h-4" /> {stats.currentStreak} Day Streak
                  </p>
                </div>
                <div className="relative grid place-items-center w-16 h-16 rounded-full bg-white/20 border border-white/40">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.5a15.5 15.5 0 1 1 0 31a15.5 15.5 0 1 1 0-31" stroke="rgba(255,255,255,0.28)" strokeWidth="2.8" fill="none" />
                    <path
                      d="M18 2.5a15.5 15.5 0 1 1 0 31a15.5 15.5 0 1 1 0-31"
                      stroke="white"
                      strokeWidth="2.8"
                      fill="none"
                      strokeDasharray={`${weeklyPerformance}, 100`}
                    />
                  </svg>
                  <span className="absolute text-xs font-bold">{weeklyPerformance}%</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/15 px-3 py-2">
                  <p className="text-indigo-100">Total Points</p>
                  <p className="text-lg font-bold">{stats.totalPoints.toLocaleString()} pts</p>
                </div>
                <div className="rounded-2xl bg-white/15 px-3 py-2">
                  <p className="text-indigo-100">Weekly Rank</p>
                  <p className="text-lg font-bold">#{myRank || '-'} in class</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-indigo-50 font-medium">Keep going! You&apos;re close to Top 5 🚀 · Tap to view leaderboard</p>
            </button>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-white/80 backdrop-blur border border-white shadow-sm p-3.5 transition-transform active:scale-[0.98]">
                <p className="text-xs text-slate-500">⭐ Total Points</p>
                <p className="text-xl font-bold text-slate-900">{stats.totalPoints.toLocaleString()}<span className="text-sm text-slate-500 ml-1">pts</span></p>
              </div>
              <div className="rounded-2xl bg-white/80 backdrop-blur border border-white shadow-sm p-3.5 transition-transform active:scale-[0.98]">
                <p className="text-xs text-slate-500">🏆 Weekly Rank</p>
                <p className="text-xl font-bold text-slate-900">#{myRank || '-'}</p>
              </div>
              <div className="rounded-2xl bg-white/80 backdrop-blur border border-white shadow-sm p-3.5 transition-transform active:scale-[0.98]">
                <p className="text-xs text-slate-500">🎯 Quiz Accuracy</p>
                <p className="text-xl font-bold text-slate-900">{stats.accuracyWeek}%</p>
              </div>
              <div className="rounded-2xl bg-white/80 backdrop-blur border border-white shadow-sm p-3.5 transition-transform active:scale-[0.98]">
                <p className="text-xs text-slate-500">📚 Quizzes Done</p>
                <p className="text-xl font-bold text-slate-900">{stats.quizzesDoneWeek}<span className="text-sm text-slate-500 ml-1">this week</span></p>
              </div>
            </div>

            <div className="rounded-3xl bg-white/80 backdrop-blur border border-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">📈 Recent Quiz Scores</p>
                <button className="text-xs font-semibold text-indigo-600">View Full History</button>
              </div>
              <div className="mt-3 space-y-2.5">
                {recentSessions.slice(0, 3).map((session) => (
                  <div key={session.id} className="rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-slate-50 px-3.5 py-3">
                    <p className="font-semibold text-slate-900">{labelForSubject(normalizeSubject(session.subject))}</p>
                    <p className="text-sm text-slate-600">Score: {session.correct_answers}/{session.total_questions} {starsForResult(session.correct_answers, session.total_questions)}</p>
                    <p className="text-sm font-semibold text-indigo-700">+{session.points_earned} points</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">{new Date(session.completed_at).toLocaleString()}</p>
                      {session.source === 'teacher' && Number(session.teacher_quiz_id) > 0 && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-indigo-600"
                          onClick={() => reviewTeacherQuiz(
                            Number(session.teacher_quiz_id),
                            normalizeSubject(session.subject),
                            teacherQuizzes.find((qz) => Number(qz.id) === Number(session.teacher_quiz_id))?.title
                          )}
                        >
                          Review Questions
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!recentSessions.length && (
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-500">No scores yet. Finish a quiz to build your winning streak.</div>
                )}
              </div>
            </div>

            <button onClick={() => setScreen('leaderboard')} className="w-full rounded-3xl bg-white/80 backdrop-blur border border-white p-4 text-left shadow-sm">
              <p className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> You are #{myRank || '-'} in {student.class_name || classLevel.toUpperCase()} this week</p>
              <p className="text-sm text-slate-600 mt-1.5">{pointsToNext} more points to overtake the next rank</p>
              <p className="mt-2 text-sm font-semibold text-indigo-600 inline-flex items-center gap-1">View Full Leaderboard <ChevronRight className="w-4 h-4" /></p>
            </button>

            {pendingTeacherQuiz && (
              <div className="rounded-3xl border border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-rose-900">📋 New Quiz from {pendingTeacherQuiz.teacher_name}</p>
                <p className="text-sm text-rose-700 mt-1 font-medium">{pendingTeacherQuiz.title}</p>
                <p className="text-xs text-rose-600 mt-0.5">Due {pendingTeacherQuiz.due_date || 'soon'}</p>
                <button
                  onClick={() => startTeacherQuiz(Number(pendingTeacherQuiz.id), normalizeSubject(pendingTeacherQuiz.subject) as SubjectKey)}
                  className="mt-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm px-4 py-2 font-semibold"
                >
                  Start Quiz →
                </button>
              </div>
            )}

            {visibleTeacherQuizzes.length > 0 && (
              <div className="rounded-3xl bg-white/80 backdrop-blur border border-white p-4 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">📝 Teacher Quizzes</p>
                  <button
                    type="button"
                    onClick={() => loadHome().catch(() => undefined)}
                    className="text-xs font-semibold text-indigo-600"
                  >
                    Refresh
                  </button>
                </div>
                {visibleTeacherQuizzes.map((qz) => (
                  <div key={qz.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{qz.title}</p>
                      <p className="text-xs text-slate-500 truncate">{qz.teacher_name} · {String(qz.subject || '').toUpperCase()} · Due {qz.due_date || 'soon'}</p>
                    </div>
                    {qz.completed ? (
                      <button
                        type="button"
                        onClick={() => reviewTeacherQuiz(Number(qz.id), normalizeSubject(qz.subject), qz.title)}
                        className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md"
                      >
                        Review
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startTeacherQuiz(Number(qz.id), normalizeSubject(qz.subject))}
                        className="text-xs font-semibold text-white bg-slate-900 px-2.5 py-1.5 rounded-md shrink-0"
                      >
                        Start
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {(availableSubjects.length ? SUBJECTS.filter((s) => availableSubjects.includes(s.key)) : []).map((s) => (
                <button
                  key={s.key}
                  onClick={() => startDailyQuiz(s.key)}
                  disabled={loading}
                  className={`rounded-3xl text-white p-4 bg-gradient-to-br ${s.color} text-left min-h-[124px] shadow-lg shadow-slate-300/40 transition-transform active:scale-[0.98] hover:scale-[1.01]`}
                >
                  <p className="text-2xl">{s.icon}</p>
                  <p className="mt-4 font-semibold">{s.label}</p>
                  <p className="text-xs text-white/90 mt-0.5">{motivationBySubject[s.key]}</p>
                </button>
              ))}
            </div>
            {availableSubjects.length === 0 && (
              <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 text-sm text-amber-800">
                No subjects available yet. Ask school admin to create subjects and assign your class teacher subjects.
              </div>
            )}
          </div>
        )}

        {(screen === 'quiz' || screen === 'review') && q && activeSubject && (
          <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
            <div className="rounded-3xl bg-white/85 backdrop-blur border border-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{SUBJECTS.find((s) => s.key === activeSubject)?.icon} {activeQuizTitle || labelForSubject(activeSubject)}</p>
                <p className="text-sm text-slate-500">Q {idx + 1} of {questions.length}</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${Math.round(((idx + 1) / questions.length) * 100)}%` }} />
              </div>
              <p className="mt-3 text-base font-medium text-slate-900 text-center leading-7">{q.questionText}</p>
              {screen === 'quiz' ? (
                <p className="text-xs text-slate-500 text-center mt-2">Current points: {Object.keys(answers).reduce((acc, key) => (answers[Number(key)] === questions[Number(key)]?.correctOption ? acc + 10 : acc), 0)}</p>
              ) : (
                <p className="text-xs text-slate-500 text-center mt-2">Revision mode: review all questions and correct answers.</p>
              )}
            </div>
            <div className="space-y-2.5">
              {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                const isSelected = selected === opt;
                const isCorrect = screen === 'review' ? q.correctOption === opt : false;
                const isWrongSelected = false;
                const bg = isCorrect
                  ? 'bg-emerald-50 border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]'
                  : isWrongSelected
                    ? 'bg-rose-50 border-rose-300 shadow-[0_0_0_1px_rgba(244,63,94,0.2)]'
                    : isSelected
                      ? 'bg-indigo-50 border-indigo-300'
                      : 'bg-white/90 border-slate-200 hover:border-slate-300';
                return (
                  <button key={opt} onClick={() => (screen === 'quiz' ? answer(opt) : undefined)} className={`w-full rounded-2xl border p-3 text-left transition-all duration-200 ${bg}`} disabled={screen === 'review'}>
                    <span className="font-semibold uppercase mr-2">{opt}.</span>{q.options[opt]}
                    {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 inline ml-2" />}
                    {isWrongSelected && <XCircle className="w-4 h-4 text-rose-600 inline ml-2" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={idx === 0}
                onClick={() => {
                  if (idx > 0) {
                    const prev = idx - 1;
                    setIdx(prev);
                    setSelected(answers[prev] || null);
                  }
                }}
              >
                Previous
              </button>
              {idx < questions.length - 1 ? (
                <button
                  type="button"
                  className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold"
                  onClick={() => {
                    const next = idx + 1;
                    setIdx(next);
                    setSelected(answers[next] || null);
                  }}
                >
                  Next
                </button>
              ) : screen === 'quiz' ? (
                <button
                  type="button"
                  className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled={Object.keys(answers).length < questions.length}
                  onClick={submitQuiz}
                >
                  Submit Quiz
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold"
                  onClick={() => setScreen('home')}
                >
                  Back Home
                </button>
              )}
            </div>
          </div>
        )}

        {screen === 'result' && (
          <div className="rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-center space-y-3 animate-in zoom-in-95 duration-300 shadow-xl text-white">
            <p className="text-2xl font-bold">🎯 Quiz Completed!</p>
            <p className="text-5xl font-black">{score} <span className="text-2xl font-semibold text-indigo-100">/ {questions.length}</span></p>
            <p className="text-3xl inline-flex items-center justify-center gap-1"><Star className="w-6 h-6 fill-current" /> {starsForResult(score, questions.length)}</p>
            <p className="text-xl font-semibold">+{pointsEarned} Points</p>
            <p className="text-sm text-indigo-100 inline-flex items-center gap-1"><Sparkles className="w-4 h-4" /> Excellent work! Keep pushing for Top 5</p>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => { setScreen('home'); }}
                className="rounded-xl bg-white text-indigo-700 px-4 py-2 text-sm font-semibold"
              >
                Try Another Subject
              </button>
              <button onClick={() => setScreen('leaderboard')} className="rounded-xl border border-white/50 bg-white/20 text-white px-4 py-2 text-sm font-semibold">
                View Leaderboard
              </button>
            </div>
          </div>
        )}

        {screen === 'leaderboard' && (
          <div className="rounded-3xl bg-white/85 backdrop-blur border border-white p-4 animate-in slide-in-from-right-2 duration-300">
            <div className="flex items-center justify-between">
              <p className="font-bold">🏆 {student.class_name || classLevel.toUpperCase()} — This Week</p>
              <button onClick={() => setScreen('home')} className="text-sm text-indigo-600 font-semibold">Close</button>
            </div>
            <div className="mt-3 rounded-xl border overflow-hidden">
              <div className="grid grid-cols-[64px_1fr_120px] bg-slate-100/80 px-3 py-2 text-xs font-semibold text-slate-600">
                <span>Rank</span>
                <span>Student</span>
                <span className="text-right">Marks Points</span>
              </div>
              <div className="max-h-[52vh] overflow-y-auto">
                {leaderboard.slice(0, 30).map((row) => (
                  <div key={row.studentId} className={`grid grid-cols-[64px_1fr_120px] px-3 py-2.5 border-t text-sm ${row.isMe ? 'bg-indigo-50' : 'bg-white'}`}>
                    <span className="font-semibold text-slate-700">{row.rank}</span>
                    <span className="truncate">{row.name}{row.isMe ? ' ← You' : ''}</span>
                    <span className="text-right font-semibold text-indigo-700">{row.points}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-indigo-50 border border-indigo-100 p-3">
              <p className="text-xs text-indigo-700 font-medium">Leaderboard resets every Monday</p>
              <div className="mt-2 h-2 rounded-full bg-indigo-100 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, Math.max(8, 100 - pointsToNext))}%` }} />
              </div>
              <p className="text-xs text-indigo-700 mt-1">{pointsToNext} points to next rank</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

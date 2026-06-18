import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GraduationCap, LogOut, BookOpen, Trophy, CreditCard,
  CalendarCheck, Eye, EyeOff, Lock, ChevronRight, Medal,
  TrendingUp, CheckCircle2, XCircle, Clock, AlertTriangle,
  Home, RefreshCw, Activity, Bell, X, MessageSquare, Send, Phone, Mail, Plus, Paperclip, Cake, FileText,
} from 'lucide-react';
import ReceiptPrinter from '@/components/common/ReceiptPrinter';
import { parseReceiptSnapshot, termsMatch } from '@/utils/feeCalculations';
import { io, Socket } from 'socket.io-client';
import { detectTenantSlugFromHost } from '@/utils/tenantHost';
import { applyTenantPwaBranding } from '@/utils/pwaBranding';
import { getFcmToken, removeFcmToken } from '@/services/firebase';
import StudentLearningMode from '@/components/parent/StudentLearningMode';
import { BrandedLoading, BrandedLoadingScreen } from '@/components/common/BrandedLoading';
import { getFriendlyLoginMessage } from '@/utils/loginErrors';
import { formatDisplayDate } from '@/utils/dateFormat';
import { resolveSocketBaseUrl, SOCKET_IO_OPTIONS } from '@/utils/socketUrl';
import FinanceStatementModal from '@/components/finance/FinanceStatementModal';
import TermBillBreakdown from '@/components/fees/TermBillBreakdown';
import { isFinanceStatementNotificationUrl } from '@/services/studentFinanceStatementApi';
import AdmissionLetterDocument, { printAdmissionLetter } from '@/components/students/AdmissionLetterDocument';
import type { AdmissionLetterData } from '@/components/students/AdmissionLetterDocument';

function resolveApiBase(): string {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3001/api';
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  return '/api';
}

const API = resolveApiBase();
const API_ROOT = API.replace(/\/api\/?$/, '');
const FIREBASE_WEB_PUSH_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
const MESSAGE_TYPE_LABEL: Record<'absence' | 'fee' | 'academic' | 'teacher' | 'late' | 'general', string> = {
  absence: 'Absence Notice',
  fee: 'Fee Query',
  academic: 'Academic Concern',
  teacher: 'Teacher Concern',
  late: 'Late Arrival',
  general: 'General Enquiry',
};

async function parseParentResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (!res.ok) {
      throw new Error(`Server returned an invalid response (HTTP ${res.status}). Check your API URL.`);
    }
    return {};
  }
}

const parentInFlight = new Map<string, Promise<Record<string, unknown>>>();

function parentRequestKey(method: string, path: string, body: unknown): string {
  const raw = typeof body === 'string' ? body : body instanceof FormData ? 'form-data' : JSON.stringify(body ?? '');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  return `${method}:${path}:${Math.abs(hash).toString(36)}`;
}

async function parentFetch(path: string, opts: RequestInit = {}, token?: string) {
  const method = String(opts.method || 'GET').toUpperCase();
  const key = parentRequestKey(method, path, opts.body);
  if (method !== 'GET' && parentInFlight.has(key)) {
    return parentInFlight.get(key)!;
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const slug = detectTenantSlugFromHost();
  if (slug) headers['X-Tenant-Slug'] = slug;
  if (method !== 'GET') headers['X-Idempotency-Key'] = key;
  const request = (async () => {
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    const data = await parseParentResponse(res);
    if (!res.ok) {
      const err = data.error;
      throw new Error(typeof err === 'string' && err.trim() ? err : `Request failed (HTTP ${res.status})`);
    }
    return data;
  })();
  if (method !== 'GET') {
    parentInFlight.set(key, request);
    request.finally(() => parentInFlight.delete(key));
  }
  return request;
}

async function parentFetchForm(path: string, formData: FormData, token?: string) {
  const key = parentRequestKey('POST_FORM', path, 'form-data');
  if (parentInFlight.has(key)) return parentInFlight.get(key)!;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const slug = detectTenantSlugFromHost();
  if (slug) headers['X-Tenant-Slug'] = slug;
  headers['X-Idempotency-Key'] = key;
  const request = (async () => {
    const res = await fetch(`${API}${path}`, { method: 'POST', body: formData, headers });
    const data = await parseParentResponse(res);
    if (!res.ok) {
      const err = data.error;
      throw new Error(typeof err === 'string' && err.trim() ? err : `Request failed (HTTP ${res.status})`);
    }
    return data;
  })();
  parentInFlight.set(key, request);
  request.finally(() => parentInFlight.delete(key));
  return request;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${API_ROOT}${url.startsWith('/') ? '' : '/'}${url}`;
}

const GH = (n: number) => `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getLetterGrade = (pct: number) => {
  if (pct >= 80) return { letter: 'A', color: 'text-green-700 bg-green-50 border-green-200' };
  if (pct >= 70) return { letter: 'B', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (pct >= 60) return { letter: 'C', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
  if (pct >= 50) return { letter: 'D', color: 'text-orange-700 bg-orange-50 border-orange-200' };
  return { letter: 'F', color: 'text-red-700 bg-red-50 border-red-200' };
};

const positionLabel = (n: number) => {
  if (n === 1) return '1st 🥇';
  if (n === 2) return '2nd 🥈';
  if (n === 3) return '3rd 🥉';
  return `${n}th`;
};

const fmtDate = (d: string) => formatDisplayDate(d);

const getBECEGradeInfo = (score: number) => {
  if (score >= 80) return 1;
  if (score >= 70) return 2;
  if (score >= 60) return 3;
  if (score >= 45) return 4;
  if (score >= 40) return 5;
  if (score >= 35) return 6;
  if (score >= 30) return 7;
  if (score >= 25) return 8;
  return 9;
};

const getGhanaianGradeInfo = (score: number) => {
  if (score >= 80) return { grade: 'A', remark: 'Excellent' };
  if (score >= 70) return { grade: 'B', remark: 'Very Good' };
  if (score >= 60) return { grade: 'C', remark: 'Good' };
  if (score >= 45) return { grade: 'D', remark: 'Credit' };
  if (score >= 35) return { grade: 'E', remark: 'Pass' };
  return { grade: 'F', remark: 'Fail' };
};

const calculateBECE = (subjectScores: Record<string, { score: number }>) => {
  const cores = { english: 9, science: 9, maths: 9, social: 9 };
  const electives: number[] = [];

  Object.entries(subjectScores || {}).forEach(([subj, info]) => {
    const sName = subj.toLowerCase();
    const g = getBECEGradeInfo(info?.score || 0);
    if (sName.includes('english')) {
      cores.english = g;
    } else if (sName.includes('science')) {
      cores.science = g;
    } else if (sName.includes('math')) {
      cores.maths = g;
    } else if (sName.includes('social')) {
      cores.social = g;
    } else {
      electives.push(g);
    }
  });

  electives.sort((a, b) => a - b);
  const bestElectives = electives.slice(0, 2);
  while (bestElectives.length < 2) {
    bestElectives.push(9);
  }

  const coreSum = cores.english + cores.science + cores.maths + cores.social;
  const electiveSum = bestElectives.reduce((sum, val) => sum + val, 0);
  const aggregate = coreSum + electiveSum;

  return { cores, bestElectives, aggregate };
};

const parseTeacherRemarkDetails = (rawRemark: string) => {
  try {
    if (rawRemark && rawRemark.trim().startsWith('{')) {
      const parsed = JSON.parse(rawRemark);
      return {
        text: parsed.text ?? '',
        conduct: parsed.conduct ?? 'Humble',
        attitude: parsed.attitude ?? 'Dependable',
        interest: parsed.interest ?? 'Sports',
        attendance: parsed.attendance ?? '',
        attendanceOutOf: parsed.attendanceOutOf ?? '67',
        promotedTo: parsed.promotedTo ?? '',
        reopeningDate: parsed.reopeningDate ?? '21st April, 2026',
      };
    }
  } catch (e) {
    // fallback
  }
  return {
    text: rawRemark ?? '',
    conduct: 'Humble',
    attitude: 'Dependable',
    interest: 'Sports',
    attendance: '',
    attendanceOutOf: '67',
    promotedTo: '',
    reopeningDate: '21st April, 2026',
  };
};

const positionSuffix = (n: number) =>
  n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;


function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function ensurePushSubscription(token: string, tenantId?: number) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

  const perm = Notification.permission === 'default'
    ? await Notification.requestPermission().catch(() => 'default' as NotificationPermission)
    : Notification.permission;
  if (perm !== 'granted') return;

  const swReg = await navigator.serviceWorker.ready;
  let subscription = await swReg.pushManager.getSubscription();
  if (!subscription) {
    const keyRes = await parentFetch('/parent/push/public-key', {}, token).catch(() => null);
    const publicKey = keyRes?.publicKey;
    if (!publicKey) return;
    subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // Always sync subscription to backend even if it already exists in browser.
  await parentFetch(
    '/parent/push/subscribe',
    { method: 'POST', body: JSON.stringify(subscription) },
    token
  ).catch(() => undefined);

  if (FIREBASE_WEB_PUSH_VAPID_KEY) {
    const fcmToken = await getFcmToken(FIREBASE_WEB_PUSH_VAPID_KEY).catch(() => null);
    if (fcmToken) {
      if (tenantId) localStorage.setItem(`parent_fcm_token_${tenantId}`, fcmToken);
      await parentFetch(
        '/parent/push/fcm-token',
        { method: 'POST', body: JSON.stringify({ token: fcmToken }) },
        token
      ).catch(() => undefined);
    }
  } else {
    console.warn('[parent] VITE_FIREBASE_VAPID_KEY missing; skipping FCM token registration');
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentInfo {
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name: string;
  class_assigned_id?: number | null;
  gender: string;
  school_name: string;
  current_term: string;
  current_year: string;
  must_change_password: boolean;
  passport_photo_url?: string | null;
  school_logo_url?: string | null;
  is_beneficiary?: boolean;
  beneficiary_type?: string | null;
  discount_type?: string | null;
  discount_value?: number;
  beneficiary_notes?: string | null;
  guardian_name?: string | null;
  guardian_contact?: string | null;
  id?: number;
}

interface LinkedAccount {
  token: string;
  student: StudentInfo;
}

type Tab = 'overview' | 'grades' | 'position' | 'finance' | 'attendance' | 'desk';
type ParentAppNotification = {
  id: string;
  serverId?: number;
  title: string;
  message: string;
  url?: string;
  at: number;
  read: boolean;
};

function isFinanceStatementNotification(n: Pick<ParentAppNotification, 'url' | 'title'>): boolean {
  return isFinanceStatementNotificationUrl(n.url) || /finance statement/i.test(n.title);
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ParentPortalProps {
  tenantId: number;
  schoolName?: string;
  schoolLogoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

const ParentPortal: React.FC<ParentPortalProps> = ({ tenantId, schoolName, schoolLogoUrl, primaryColor, secondaryColor }) => {
  const brandPrimary = primaryColor || '#7c3aed';
  const brandSecondary = secondaryColor || '#db2777';
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(`parent_token_${tenantId}`)
  );
  const [student, setStudent] = useState<StudentInfo | null>(() => {
    const s = localStorage.getItem(`parent_student_${tenantId}`);
    return s ? JSON.parse(s) : null;
  });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isStudentMode, setIsStudentMode] = useState(false);
  const [studentModeEntering, setStudentModeEntering] = useState(false);
  const [studentModeSignal, setStudentModeSignal] = useState(0);
  const [newQuizPopup, setNewQuizPopup] = useState<{ id: number; title: string; teacherName?: string; dueDate?: string | null } | null>(null);

  // Login form
  const [loginAdmission, setLoginAdmission] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Password change form
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPwNew, setShowPwNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Data
  const [grades, setGrades] = useState<any>(null);
  const [termReport, setTermReport] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [birthdayInfo, setBirthdayInfo] = useState<{ birthdays: Array<{ id: number; fullName: string; age: number }> } | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [deskMessages, setDeskMessages] = useState<any[]>([]);
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskComposeOpen, setDeskComposeOpen] = useState(false);
  const [deskType, setDeskType] = useState<'absence' | 'fee' | 'academic' | 'teacher' | 'late' | 'general'>('general');
  const [deskBody, setDeskBody] = useState('');
  const [deskAttachment, setDeskAttachment] = useState<File | null>(null);
  const [selectedDeskMessage, setSelectedDeskMessage] = useState<any | null>(null);
  const [deskConversation, setDeskConversation] = useState<any[]>([]);
  const [deskContact, setDeskContact] = useState<any>({});
  const [deskReply, setDeskReply] = useState('');
  const [deskReplyAttachment, setDeskReplyAttachment] = useState<File | null>(null);
  const [parentDeskUnread, setParentDeskUnread] = useState(0);
  const parentScrollRef = useRef<HTMLDivElement>(null);
  const deskComposeFileRef = useRef<HTMLInputElement>(null);
  const deskReplyFileRef = useRef<HTMLInputElement>(null);
  const reportCardRef = useRef<HTMLDivElement>(null);

  const handlePrintReportCard = () => {
    const content = reportCardRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const studentName = student ? `${student.first_name} ${student.last_name}` : 'Student';
    win.document.write(`
      <html>
        <head>
          <title>Terminal Report Card - ${studentName}</title>
          <style>
            @page {
              margin: 5mm;
              size: A4 portrait;
            }
            @media print {
              body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
              .report-card {
                max-width: none !important;
                width: 100% !important;
                padding: 10px !important;
              }
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              background: #fff;
              margin: 10px;
              font-size: 13px;
            }
            .report-card {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              border: 1px solid #000;
              background: #fff;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            td, th {
              padding: 6px;
              vertical-align: middle;
            }
            .border-none td {
              border: none;
            }
            .border-all th, .border-all td {
              border: 2px solid #000;
            }
          </style>
        </head>
        <body>
          <div class="report-card">
            ${content.innerHTML}
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };
  /** Incremented on every student switch — stale API responses must not update state. */
  const studentSessionRef = useRef(0);
  const [isSwitchingStudent, setIsSwitchingStudent] = useState(false);

  useEffect(() => {
    if (selectedDeskMessage || deskConversation.length > 0) {
      setTimeout(() => parentScrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [selectedDeskMessage, deskConversation]);

  const [appNotifications, setAppNotifications] = useState<ParentAppNotification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notifBellRef = useRef<HTMLButtonElement>(null);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<ParentAppNotification | null>(null);
  const [financeStatementOpen, setFinanceStatementOpen] = useState(false);
  const [admissionLetters, setAdmissionLetters] = useState<Array<{ id: number; version_number: number; reference_number: string | null; created_at: string }>>([]);
  const [selectedAdmissionLetter, setSelectedAdmissionLetter] = useState<AdmissionLetterData | null>(null);
  const [showDeskGuide, setShowDeskGuide] = useState(false);

  // Photo lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Multi-account switcher
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>(() => {
    const saved = localStorage.getItem(`parent_accounts_${tenantId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [showSwitcher, setShowSwitcher] = useState(false);

  const syncLinkedAccounts = (accounts: LinkedAccount[]) => {
    setLinkedAccounts(accounts);
    localStorage.setItem(`parent_accounts_${tenantId}`, JSON.stringify(accounts));
  };

  const clearAllStudentData = useCallback(() => {
    setGrades(null);
    setTermReport(null);
    setFinance(null);
    setAttendance(null);
    setDeskMessages([]);
    setDeskConversation([]);
    setSelectedDeskMessage(null);
    setSelectedReceipt(null);
    setShowReceipt(false);
    setFinanceStatementOpen(false);
    setAppNotifications([]);
    setSelectedNotification(null);
    setNewQuizPopup(null);
    setParentDeskUnread(0);
    setDeskComposeOpen(false);
    setDeskBody('');
    setDeskReply('');
    setDeskAttachment(null);
    setDeskReplyAttachment(null);
    setIsStudentMode(false);
    setStudentModeEntering(false);
  }, []);

  const beginStudentSessionTransition = useCallback(() => {
    studentSessionRef.current += 1;
    clearAllStudentData();
    setIsSwitchingStudent(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    return studentSessionRef.current;
  }, [clearAllStudentData]);

  const persist = (t: string, s: StudentInfo) => {
    localStorage.setItem(`parent_token_${tenantId}`, t);
    localStorage.setItem(`parent_student_${tenantId}`, JSON.stringify(s));

    setLinkedAccounts(prev => {
      const existingIdx = prev.findIndex(acc => acc.student.admission_number === s.admission_number);
      let updated;
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = { token: t, student: s };
      } else {
        updated = [...prev, { token: t, student: s }];
      }
      localStorage.setItem(`parent_accounts_${tenantId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const switchingAccountRef = useRef(false);

  const handleSwitchAccount = async (acc: LinkedAccount) => {
    if (acc.token === token && acc.student.admission_number === student?.admission_number) {
      setShowSwitcher(false);
      return;
    }
    if (switchingAccountRef.current) return;

    switchingAccountRef.current = true;
    const sessionId = beginStudentSessionTransition();
    setShowSwitcher(false);
    setActiveTab('overview');

    setToken(acc.token);
    setStudent(acc.student);
    setMustChangePassword(Boolean(acc.student.must_change_password));
    localStorage.setItem(`parent_token_${tenantId}`, acc.token);
    localStorage.setItem(`parent_student_${tenantId}`, JSON.stringify(acc.student));

    try {
      await finalizeStudentSessionTransition(sessionId, acc.token);
    } finally {
      switchingAccountRef.current = false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const data = await parentFetch('/parent/login', {
        method: 'POST',
        body: JSON.stringify({ tenantId, studentId: loginAdmission.trim(), password: loginPassword }),
      }) as { token: string; mustChangePassword: boolean; linkedAccounts?: LinkedAccount[] };

      const me = await parentFetch('/parent/me', {}, data.token) as unknown as StudentInfo;
      const studentInfo = { ...me, must_change_password: data.mustChangePassword };

      setToken(data.token);
      setMustChangePassword(data.mustChangePassword);
      setStudent(studentInfo);
      localStorage.setItem(`parent_token_${tenantId}`, data.token);
      localStorage.setItem(`parent_student_${tenantId}`, JSON.stringify(studentInfo));

      const linked = data.linkedAccounts?.length
        ? data.linkedAccounts
        : [{ token: data.token, student: studentInfo }];
      syncLinkedAccounts(linked);

      setLoginAdmission('');
      setLoginPassword('');
    } catch (err: unknown) {
      setLoginError(getFriendlyLoginMessage(err));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwLoading) return;
    setPwError('');
    setPwSuccess('');
    if (pwNew !== pwConfirm) { setPwError('Passwords do not match'); return; }
    if (pwNew.length < 6) { setPwError('Password must be at least 6 characters'); return; }
    setPwLoading(true);
    try {
      await parentFetch('/parent/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: pwNew }),
      }, token!);
      setPwSuccess('Password changed successfully!');
      setMustChangePassword(false);
      if (student) {
        const updated = { ...student, must_change_password: false };
        setStudent(updated);
        localStorage.setItem(`parent_student_${tenantId}`, JSON.stringify(updated));
      }
      setPwNew(''); setPwConfirm('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = () => {
    if (token && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (!sub) return;
          parentFetch('/parent/push/unsubscribe', {
            method: 'POST',
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }, token).catch(() => undefined);
          return sub.unsubscribe().catch(() => undefined);
        })
        .catch(() => undefined);
      const storedFcmToken = localStorage.getItem(`parent_fcm_token_${tenantId}`);
      if (storedFcmToken) {
        parentFetch('/parent/push/fcm-unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ token: storedFcmToken }),
        }, token).catch(() => undefined);
      }
      removeFcmToken().catch(() => undefined);
    }

    // Remove only the current account from linked accounts
    const updatedAccounts = linkedAccounts.filter(acc => acc.student.admission_number !== student?.admission_number);
    setLinkedAccounts(updatedAccounts);
    localStorage.setItem(`parent_accounts_${tenantId}`, JSON.stringify(updatedAccounts));

    if (updatedAccounts.length > 0) {
      void handleSwitchAccount(updatedAccounts[0]);
    } else {
      studentSessionRef.current += 1;
      clearAllStudentData();
      localStorage.removeItem(`parent_token_${tenantId}`);
      localStorage.removeItem(`parent_student_${tenantId}`);
      setToken(null);
      setStudent(null);
      setIsSwitchingStudent(false);
      setDataLoading(false);
      setActiveTab('overview');
      setAppNotifications([]);
      localStorage.removeItem(`parent_fcm_token_${tenantId}`);
    }
  };

  const pushNotification = useCallback((title: string, message: string) => {
    const next: ParentAppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      at: Date.now(),
      read: false,
    };
    setAppNotifications((prev) => [next, ...prev].slice(0, 30));

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const icon = resolveMediaUrl(student?.school_logo_url || schoolLogoUrl) || undefined;
      try {
        new Notification(title, { body: message, icon, badge: icon });
      } catch {
        // ignore notification API failures
      }
    }
  }, [student?.school_logo_url, schoolLogoUrl]);

  const loadServerNotifications = useCallback(async (authToken: string, expectedSessionId?: number) => {
    const sessionId = expectedSessionId ?? studentSessionRef.current;
    const data = await parentFetch('/parent/notifications', {}, authToken).catch(() => ({ notifications: [] }));
    if (studentSessionRef.current !== sessionId) return;
    const mapped = Array.isArray(data?.notifications)
      ? data.notifications.map((n: any) => ({
        id: `srv-${n.id}`,
        serverId: Number(n.id),
        title: n.title,
        message: n.message,
        url: typeof n.url === 'string' ? n.url : undefined,
        at: new Date(n.created_at).getTime(),
        read: Boolean(n.is_read),
      }))
      : [];
    setAppNotifications(mapped);
  }, []);

  const finalizeStudentSessionTransition = useCallback(async (sessionId: number, authToken: string) => {
    const forceClearTimer = window.setTimeout(() => {
      if (studentSessionRef.current === sessionId) {
        setIsSwitchingStudent(false);
      }
    }, 12000);

    try {
      const me = await parentFetch('/parent/me', {}, authToken) as unknown as StudentInfo;
      if (studentSessionRef.current !== sessionId) return;
      setStudent((prev) => ({
        ...me,
        must_change_password: prev?.must_change_password ?? me.must_change_password ?? false,
      }));
      if (studentSessionRef.current !== sessionId) return;
      await loadServerNotifications(authToken, sessionId);
      if (studentSessionRef.current !== sessionId) return;
      try {
        const r = await parentFetch('/messages/unread-count', {}, authToken);
        if (studentSessionRef.current !== sessionId) return;
        setParentDeskUnread(Number(r?.count ?? 0));
      } catch {
        if (studentSessionRef.current === sessionId) setParentDeskUnread(0);
      }
    } finally {
      window.clearTimeout(forceClearTimer);
      if (studentSessionRef.current === sessionId) {
        setIsSwitchingStudent(false);
      }
    }
  }, [loadServerNotifications]);

  const openFinanceStatementFromNotification = useCallback(async (n?: ParentAppNotification | null) => {
    if (n?.serverId && token && !n.read) {
      await parentFetch(`/parent/notifications/${n.serverId}/read`, { method: 'POST', body: JSON.stringify({}) }, token).catch(() => undefined);
      setAppNotifications((prev) =>
        prev.map((item) => (item.serverId === n.serverId ? { ...item, read: true } : item))
      );
    }
    setSelectedNotification(null);
    setShowNotifPanel(false);
    setActiveTab('finance');
    setFinanceStatementOpen(true);
  }, [token]);

  const unreadFinanceStatementCount = appNotifications.filter((n) => !n.read && isFinanceStatementNotification(n)).length;

  /** Close notifications panel when clicking outside (not on bell or panel), or on Escape. */
  useEffect(() => {
    if (!showNotifPanel) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (notifPanelRef.current?.contains(t)) return;
      if (notifBellRef.current?.contains(t)) return;
      setShowNotifPanel(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNotifPanel(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [showNotifPanel]);

  /** Load admin-linked sibling accounts so parents can switch without logging in again. */
  useEffect(() => {
    if (!token || !student) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await parentFetch('/parent/linked-accounts', {}, token) as { linkedAccounts?: LinkedAccount[] };
        if (cancelled || !data.linkedAccounts?.length) return;
        syncLinkedAccounts(data.linkedAccounts);
        const current = data.linkedAccounts.find(
          (acc) => acc.student.admission_number === student.admission_number
        );
        if (current && current.token !== token) {
          setToken(current.token);
          localStorage.setItem(`parent_token_${tenantId}`, current.token);
        }
      } catch {
        /* keep cached linked accounts */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, student?.admission_number, tenantId]);

  /** Sliding session: refresh JWT periodically so parents stay signed in across PWA restarts. */
  useEffect(() => {
    if (!token || !student) return;
    const refreshSession = async () => {
      try {
        const data = await parentFetch('/parent/refresh', { method: 'POST', body: JSON.stringify({}) }, token) as { token: string };
        if (!data?.token || data.token === token) return;
        setToken(data.token);
        localStorage.setItem(`parent_token_${tenantId}`, data.token);
        localStorage.setItem(`parent_student_${tenantId}`, JSON.stringify(student));
        setLinkedAccounts((prev) => {
          const updated = prev.map((acc) =>
            acc.student.admission_number === student.admission_number ? { ...acc, token: data.token } : acc
          );
          localStorage.setItem(`parent_accounts_${tenantId}`, JSON.stringify(updated));
          return updated;
        });
      } catch {
        /* keep existing token until explicit logout or failed protected call */
      }
    };
    void refreshSession();
    const id = window.setInterval(refreshSession, 24 * 60 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshSession();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [token, student, tenantId]);

  const refreshParentDeskUnread = useCallback(async () => {
    if (!token) return;
    try {
      const r = await parentFetch('/messages/unread-count', {}, token);
      setParentDeskUnread(Number(r?.count ?? 0));
    } catch {
      setParentDeskUnread(0);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void refreshParentDeskUnread();
    const id = window.setInterval(() => void refreshParentDeskUnread(), 60000);
    return () => window.clearInterval(id);
  }, [token, refreshParentDeskUnread]);

  const loadDeskMessages = useCallback(async (expectedSessionId?: number) => {
    if (!token) return;
    const sessionId = expectedSessionId ?? studentSessionRef.current;
    setDeskLoading(true);
    try {
      const data = await parentFetch('/messages?page=1&limit=20', {}, token);
      if (studentSessionRef.current !== sessionId) return;
      setDeskMessages(Array.isArray(data?.messages) ? data.messages : []);
      setDeskContact(data?.contact || {});
    } catch {
      if (studentSessionRef.current !== sessionId) return;
      setDeskMessages([]);
    } finally {
      if (studentSessionRef.current === sessionId) {
        setDeskLoading(false);
        void refreshParentDeskUnread();
      }
    }
  }, [token, refreshParentDeskUnread]);

  const openDeskConversation = useCallback(async (id: number) => {
    if (!token) return;
    const sessionId = studentSessionRef.current;
    const data = await parentFetch(`/messages/${id}`, {}, token);
    if (studentSessionRef.current !== sessionId) return;
    setSelectedDeskMessage(data?.message || null);
    setDeskConversation(Array.isArray(data?.replies) ? data.replies : []);
    await parentFetch(`/messages/${id}/read`, { method: 'PUT', body: JSON.stringify({}) }, token).catch(() => undefined);
    if (studentSessionRef.current !== sessionId) return;
    setDeskMessages((prev) => prev.map((m) => (Number(m.id) === Number(id) ? { ...m, unread_replies: 0 } : m)));
    void refreshParentDeskUnread();
  }, [token, refreshParentDeskUnread]);

  const submitDeskMessage = useCallback(async () => {
    if (!token || !deskBody.trim()) return;
    const autoSubject = MESSAGE_TYPE_LABEL[deskType];
    const form = new FormData();
    form.append('type', deskType);
    form.append('subject', autoSubject);
    form.append('message', deskBody.trim());
    if (deskAttachment) form.append('attachment', deskAttachment);
    await parentFetchForm('/messages', form, token);
    setDeskComposeOpen(false);
    setDeskBody('');
    setDeskAttachment(null);
    await loadDeskMessages();
    void refreshParentDeskUnread();
  }, [token, deskType, deskBody, deskAttachment, loadDeskMessages, refreshParentDeskUnread]);

  const submitDeskReply = useCallback(async () => {
    if (!token || !selectedDeskMessage?.id || !deskReply.trim()) return;
    const form = new FormData();
    form.append('reply_text', deskReply.trim());
    if (deskReplyAttachment) form.append('attachment', deskReplyAttachment);
    await parentFetchForm(`/messages/${selectedDeskMessage.id}/reply`, form, token);
    setDeskReply('');
    setDeskReplyAttachment(null);
    await openDeskConversation(Number(selectedDeskMessage.id));
    await loadDeskMessages();
    void refreshParentDeskUnread();
  }, [token, selectedDeskMessage, deskReply, deskReplyAttachment, openDeskConversation, loadDeskMessages, refreshParentDeskUnread]);

  const fetchTabData = useCallback(async (tab: Tab) => {
    if (!token || !student) return;
    const sessionId = studentSessionRef.current;
    setDataLoading(true);
    try {
      if (tab === 'grades') {
        const d = await parentFetch('/parent/grades', {}, token);
        if (studentSessionRef.current !== sessionId) return;
        setGrades(d);
      } else if (tab === 'position') {
        const d = await parentFetch('/parent/term-report', {}, token);
        if (studentSessionRef.current !== sessionId) return;
        setTermReport(d);
      } else if (tab === 'finance') {
        const d = await parentFetch('/parent/finance', {}, token);
        if (studentSessionRef.current !== sessionId) return;
        setFinance(d);
      } else if (tab === 'attendance') {
        const d = await parentFetch('/parent/attendance', {}, token);
        if (studentSessionRef.current !== sessionId) return;
        setAttendance(d);
      } else if (tab === 'desk') {
        await loadDeskMessages(sessionId);
      }
    } catch (err: any) {
      console.error(`Error loading ${tab}:`, err);
    } finally {
      if (studentSessionRef.current === sessionId) {
        setDataLoading(false);
      }
    }
  }, [token, student?.admission_number, loadDeskMessages]);

  const refreshFinanceAll = useCallback(async () => {
    if (!token || !student) return;
    const sessionId = studentSessionRef.current;
    setDataLoading(true);
    try {
      const [financeData, meData] = await Promise.all([
        parentFetch('/parent/finance', {}, token),
        parentFetch('/parent/me', {}, token).catch(() => null),
      ]);
      if (studentSessionRef.current !== sessionId) return;
      setFinance(financeData);
      if (meData) {
        setStudent((prev) => ({
          ...(meData as StudentInfo),
          must_change_password: prev?.must_change_password ?? (meData as StudentInfo).must_change_password ?? false,
        }));
      }
      await loadServerNotifications(token, sessionId);
    } catch (err: unknown) {
      console.error('Finance refresh error:', err);
    } finally {
      if (studentSessionRef.current === sessionId) {
        setDataLoading(false);
      }
    }
  }, [token, student, loadServerNotifications]);

  useEffect(() => {
    if (!token || !student?.admission_number || isSwitchingStudent) return;
    if (activeTab === 'overview') return;
    void fetchTabData(activeTab);
  }, [token, student?.admission_number, activeTab, isSwitchingStudent, fetchTabData]);

  useEffect(() => {
    if (!token || isSwitchingStudent) return;
    const sessionId = studentSessionRef.current;
    void parentFetch('/parent/birthdays', {}, token)
      .then((data) => {
        if (studentSessionRef.current !== sessionId) return;
        setBirthdayInfo(data as any);
      })
      .catch(() => undefined);
  }, [token, student?.id, isSwitchingStudent]);

  useEffect(() => {
    if (!token || activeTab !== 'finance' || isSwitchingStudent) return;
    const sessionId = studentSessionRef.current;
    const interval = window.setInterval(() => {
      parentFetch('/parent/finance', {}, token)
        .then((d) => {
          if (studentSessionRef.current !== sessionId) return;
          setFinance(d);
        })
        .catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(interval);
  }, [token, activeTab, isSwitchingStudent, student?.admission_number]);

  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    ensurePushSubscription(token, tenantId).catch(() => undefined);
    loadServerNotifications(token, studentSessionRef.current).catch(() => undefined);

    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'finance' && params.get('openStatement') === '1') {
      setActiveTab('finance');
      setFinanceStatementOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Keep backend subscription in sync on long-lived sessions/devices.
    const syncInterval = window.setInterval(() => {
      ensurePushSubscription(token, tenantId).catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(syncInterval);
  }, [token, tenantId, loadServerNotifications]);

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(resolveSocketBaseUrl(), {
      ...SOCKET_IO_OPTIONS,
      auth: { token },
      autoConnect: true,
    });

    socket.on('tenant-data-changed', async (evt: any) => {
      if (evt?.tenantId && Number(evt.tenantId) !== Number(tenantId)) return;
      const sessionId = studentSessionRef.current;
      const entity = String(evt?.entity || '');
      if (entity === 'payment' || entity === 'finance-payment') {
        const d = await parentFetch('/parent/finance', {}, token).catch(() => null);
        if (studentSessionRef.current !== sessionId) return;
        if (d) setFinance(d);
        const isCorrection = evt?.action === 'updated';
        pushNotification(
          isCorrection ? 'Receipt Updated' : 'Fee Payment Received',
          isCorrection
            ? 'A payment receipt for your ward was corrected. Please review the updated receipt.'
            : 'A new payment receipt has been recorded for your ward.'
        );
        await loadServerNotifications(token, studentSessionRef.current).catch(() => undefined);
      } else if (entity === 'term-report-release') {
        const d = await parentFetch('/parent/term-report', {}, token).catch(() => null);
        if (studentSessionRef.current !== sessionId) return;
        if (d) setTermReport(d);
        pushNotification('Results Released', 'New term results are now available in your portal.');
        await loadServerNotifications(token, studentSessionRef.current).catch(() => undefined);
      } else if (entity === 'finance-statement-sent') {
        pushNotification(
          'Finance Statement Available',
          'Your ward\'s finance statement is ready to view or download on the Finance tab.'
        );
        await loadServerNotifications(token, studentSessionRef.current).catch(() => undefined);
      } else if (entity === 'admin-test-push') {
        const rawIds = evt?.targetStudentIds;
        const targetStudentIds = Array.isArray(rawIds)
          ? rawIds.map((x: unknown) => Number(x)).filter((n) => Number.isFinite(n))
          : [];
        const targetStudentIdLegacy =
          evt?.targetStudentId != null && evt.targetStudentId !== '' ? Number(evt.targetStudentId) : null;
        const targetClassId =
          evt?.targetClassId != null && evt.targetClassId !== '' ? Number(evt.targetClassId) : null;
        const myStudentId = student?.id != null ? Number(student.id) : null;
        const myClassId = student?.class_assigned_id != null ? Number(student.class_assigned_id) : null;
        if (targetStudentIds.length > 0) {
          if (myStudentId == null || !targetStudentIds.includes(myStudentId)) return;
        } else if (targetStudentIdLegacy != null && Number.isFinite(targetStudentIdLegacy)) {
          if (myStudentId == null || myStudentId !== targetStudentIdLegacy) return;
        }
        if (targetClassId != null && Number.isFinite(targetClassId)) {
          if (myClassId == null || myClassId !== targetClassId) return;
        }
        pushNotification(evt?.title || 'Test Notification', evt?.body || 'School sent a push notification test.');
        await loadServerNotifications(token, studentSessionRef.current).catch(() => undefined);
      } else if (entity === 'learning-teacher-quiz') {
        setStudentModeSignal((v) => v + 1);
        const q = await parentFetch('/student/teacher-quizzes', {}, token).catch(() => null);
        const pending = Array.isArray(q?.quizzes) ? q.quizzes.find((x: any) => !x?.completed) : null;
        if (pending?.id) {
          setNewQuizPopup({
            id: Number(pending.id),
            title: String(pending.title || 'New Quiz'),
            teacherName: pending.teacher_name ? String(pending.teacher_name) : '',
            dueDate: pending.due_date ? String(pending.due_date) : null,
          });
        }
      } else if (entity === 'parent-desk') {
        void refreshParentDeskUnread();
        if (activeTab === 'desk') {
          await loadDeskMessages();
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, tenantId, student?.admission_number, pushNotification, loadServerNotifications, refreshParentDeskUnread, activeTab, loadDeskMessages]);

  const showTabLoading = isSwitchingStudent || dataLoading;

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  const refreshTab = async () => {
    if (!token) return;
    if (activeTab === 'finance') {
      await refreshFinanceAll();
      return;
    }
    const sessionId = studentSessionRef.current;
    setDataLoading(true);
    try {
      if (activeTab === 'grades') {
        const d = await parentFetch('/parent/grades', {}, token);
        if (studentSessionRef.current !== sessionId) return;
        setGrades(d);
      } else if (activeTab === 'position') {
        const d = await parentFetch('/parent/term-report', {}, token);
        if (studentSessionRef.current !== sessionId) return;
        setTermReport(d);
      } else if (activeTab === 'attendance') {
        const d = await parentFetch('/parent/attendance', {}, token);
        if (studentSessionRef.current !== sessionId) return;
        setAttendance(d);
      } else if (activeTab === 'desk') {
        await loadDeskMessages(sessionId);
      } else if (activeTab === 'overview') {
        await refreshFinanceAll();
        parentFetch('/parent/admission-letters', {}, token).then((d) => {
          if (studentSessionRef.current === sessionId) setAdmissionLetters((d || []) as any);
        }).catch(() => { });
      }
    } catch { /* silent */ }
    finally {
      if (studentSessionRef.current === sessionId) {
        setDataLoading(false);
      }
    }
  };

  const hardRefreshApp = useCallback(async () => {
    if (!token || isSwitchingStudent) return;
    const sessionId = studentSessionRef.current;
    try {
      setHardRefreshing(true);
      const [financeData, termData, gradesData, attendanceData, meData, admissionLettersData] = await Promise.all([
        parentFetch('/parent/finance', {}, token).catch(() => null),
        parentFetch('/parent/term-report', {}, token).catch(() => null),
        parentFetch('/parent/grades', {}, token).catch(() => null),
        parentFetch('/parent/attendance', {}, token).catch(() => null),
        parentFetch('/parent/me', {}, token).catch(() => null),
        parentFetch('/parent/admission-letters', {}, token).catch(() => null),
      ]);
      if (studentSessionRef.current !== sessionId) return;
      if (financeData) setFinance(financeData);
      if (termData) setTermReport(termData);
      if (gradesData) setGrades(gradesData);
      if (attendanceData) setAttendance(attendanceData);
      if (meData) setStudent(meData as StudentInfo);
      if (admissionLettersData) setAdmissionLetters(admissionLettersData);
      await loadServerNotifications(token, studentSessionRef.current).catch(() => undefined);
    } finally {
      if (studentSessionRef.current === sessionId) {
        setHardRefreshing(false);
      }
    }
  }, [token, isSwitchingStudent, loadServerNotifications]);

  // Tab-scoped fetches only — no background bulk refresh of every parent endpoint.

  const openReceipt = (payment: any) => {
    if (!student || !finance) return;
    const snap = parseReceiptSnapshot(payment?.receipt_snapshot);
    if (snap) {
      setSelectedReceipt({
        studentName: `${student.first_name} ${student.last_name}`,
        studentId: student.admission_number,
        className: student.class_name,
        amount: parseFloat(payment?.amount_paid || '0'),
        date: payment?.payment_date,
        paymentMethod: payment?.payment_method || 'N/A',
        term: payment?.term || finance.currentTermLabel || finance.currentTerm,
        receiptNumber: payment?.receipt_number || 'N/A',
        notes: payment?.notes || (payment?.reference_number ? `Ref: ${payment.reference_number}` : ''),
        remainingBalance: snap.balanceAfter,
        arrears: snap.arrears,
        currentTermFee: snap.termFee,
        totalAmountDue: snap.totalDue,
      });
      setShowReceipt(true);
      return;
    }

    const anchorTerm = String(payment?.term || finance.currentTermLabel || finance.currentTerm || '').trim();
    const totalDue = Number(finance.totalDue || 0);
    const termFee = Number(finance.termFee || 0);
    const arrears = Number(finance.arrears || 0);
    const list = [...(finance.payments || [])]
      .filter((p: any) => {
        const pt = String(p.term || '').trim();
        if (!anchorTerm) return true;
        if (!pt) return true;
        return termsMatch(anchorTerm, pt);
      })
      .sort((a: any, b: any) => {
        const ta = new Date(a.payment_date).getTime();
        const tb = new Date(b.payment_date).getTime();
        if (ta !== tb) return ta - tb;
        return Number(a.id || 0) - Number(b.id || 0);
      });
    let cumulative = 0;
    for (const p of list) {
      cumulative += parseFloat(p.amount_paid || '0');
      if (payment?.id != null && Number(p.id) === Number(payment.id)) break;
      if (payment?.id == null && p.receipt_number === payment?.receipt_number && String(p.payment_date) === String(payment?.payment_date)) break;
    }
    setSelectedReceipt({
      studentName: `${student.first_name} ${student.last_name}`,
      studentId: student.admission_number,
      className: student.class_name,
      amount: parseFloat(payment?.amount_paid || '0'),
      date: payment?.payment_date,
      paymentMethod: payment?.payment_method || 'N/A',
      term: payment?.term || finance.currentTermLabel || finance.currentTerm,
      receiptNumber: payment?.receipt_number || 'N/A',
      notes: payment?.notes || (payment?.reference_number ? `Ref: ${payment.reference_number}` : ''),
      remainingBalance: Math.max(0, totalDue - cumulative),
      arrears,
      currentTermFee: termFee,
      totalAmountDue: totalDue,
    });
    setShowReceipt(true);
  };

  // Resolved school logo — from student record (richer) or prop fallback
  const resolvedLogo = resolveMediaUrl(student?.school_logo_url || schoolLogoUrl);
  const unreadNotifCount = appNotifications.filter(n => !n.read).length;
  const premiumLoginGradient = `linear-gradient(140deg, #050816 0%, #111a2f 38%, ${brandPrimary} 72%, ${brandSecondary} 100%)`;

  // Resolved student photo
  const studentPhotoUrl = resolveMediaUrl(student?.passport_photo_url);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };
    const onInstalled = () => {
      setInstallPromptEvent(null);
      setShowInstallPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge !== 'function') return;
    if (unreadNotifCount > 0) {
      nav.setAppBadge(unreadNotifCount).catch(() => undefined);
    } else if (typeof nav.clearAppBadge === 'function') {
      nav.clearAppBadge().catch(() => undefined);
    } else {
      nav.setAppBadge(0).catch(() => undefined);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.active?.postMessage({ type: 'SET_BADGE_COUNT', count: unreadNotifCount });
        })
        .catch(() => undefined);
    }
  }, [unreadNotifCount]);

  const handleInstallApp = async () => {
    if (!installPromptEvent) {
      setShowInstallHelp(true);
      return;
    }
    try {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch {
      // ignored
    } finally {
      setShowInstallPrompt(false);
      setInstallPromptEvent(null);
    }
  };

  // ── SCREENS ──

  // ── Login screen ─────────────────────────────────────────────────────────────
  if (!token || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: premiumLoginGradient }}>
        <div className="w-full max-w-md">
          {/* School logo / branding */}
          <div className="text-center mb-8">
            {schoolLogoUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center shadow-xl shadow-purple-900/40">
                  <img
                    src={resolveMediaUrl(schoolLogoUrl) || ''}
                    alt={schoolName}
                    className="w-full h-full object-contain p-1"
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.innerHTML =
                        `<div class="w-10 h-10 text-white opacity-60"><svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 14l9-5-9-5-9 5 9 5z'/><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z'/></svg></div>`;
                    }}
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{schoolName || 'School'}</h1>
                  <p className="text-purple-300 text-sm font-medium mt-0.5">Parent Portal</p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/30">
                  <GraduationCap className="w-9 h-9 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">{schoolName || 'School'}</h1>
                <p className="text-purple-300 text-sm font-medium mt-1">Parent Portal</p>
              </>
            )}
            <p className="text-slate-400 text-sm mt-3">
              Use your child&apos;s Student ID to log in
            </p>
          </div>

          {/* Card */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 shadow-2xl relative">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1.5">Student ID</label>
                <input
                  type="text"
                  value={loginAdmission}
                  onChange={e => setLoginAdmission(e.target.value)}
                  placeholder="e.g. 12345678"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  First-time login: use your Student ID as both username and password
                </p>
              </div>

              {loginError && (
                <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full text-white font-semibold rounded-lg py-3 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(90deg, ${brandPrimary}, ${brandSecondary})` }}
              >
                {loginLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Signing in…</>
                ) : (
                  <><LogOut className="w-4 h-4 rotate-180" /> Sign In</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Force password change screen ──────────────────────────────────────────────
  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: premiumLoginGradient }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {resolvedLogo ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 border border-white/20 mx-auto mb-4">
                <img src={resolvedLogo} alt="" className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                <Lock className="w-7 h-7 text-white" />
              </div>
            )}
            <h2 className="text-xl font-bold text-white">Change Your Password</h2>
            <p className="text-slate-300 text-sm mt-1">
              You must set a new password before continuing. Your default password is your Student ID.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 shadow-2xl">
            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { label: 'New Password', val: pwNew, set: setPwNew, auto: 'new-password' },
                { label: 'Confirm New Password', val: pwConfirm, set: setPwConfirm, auto: 'new-password' },
              ].map(({ label, val, set, auto }) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-slate-200 mb-1.5">{label}</label>
                  <div className="relative">
                    <input
                      type={showPwNew ? 'text' : 'password'}
                      value={val}
                      onChange={e => set(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      required
                      autoComplete={auto}
                    />
                    <button type="button" onClick={() => setShowPwNew(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showPwNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              {pwError && (
                <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />{pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="bg-green-500/20 border border-green-400/30 text-green-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />{pwSuccess}
                </div>
              )}
              <button
                type="submit"
                disabled={pwLoading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg py-3 text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {pwLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <><Lock className="w-4 h-4" /> Set New Password</>}
              </button>
              <button type="button" onClick={handleLogout} className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors">
                Cancel & Log Out
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────────────────────

  const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: 'overview', icon: <Home className="w-4 h-4" />, label: 'Overview' },
    { key: 'grades', icon: <BookOpen className="w-4 h-4" />, label: 'Grades' },
    { key: 'position', icon: <Trophy className="w-4 h-4" />, label: 'Position' },
    { key: 'finance', icon: <CreditCard className="w-4 h-4" />, label: 'Finance' },
    { key: 'attendance', icon: <CalendarCheck className="w-4 h-4" />, label: 'Attendance' },
    { key: 'desk', icon: <MessageSquare className="w-4 h-4" />, label: 'Parent Desk' },
  ];
  const mobileTabs = tabs.filter((t) => t.key !== 'attendance');
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning 👋';
    if (hour < 17) return 'Good Afternoon 👋';
    return 'Good Evening 👋';
  })();
  const studentFullName = `${student.first_name} ${student.last_name}`;
  const scholarshipLabel = student.is_beneficiary
    ? `Discount (${student.discount_type === 'percentage' ? `${student.discount_value || 0}%` : `GHS ${(student.discount_value || 0).toLocaleString()}`})`
    : 'Private Student';
  const quickActions: {
    key: Tab;
    label: string;
    description: string;
    icon: React.ReactNode;
    tone: string;
  }[] = [
      {
        key: 'grades',
        label: 'Grades',
        description: 'View academic performance',
        icon: <BookOpen className="w-6 h-6" />,
        tone: 'from-violet-500/20 to-purple-500/10 text-violet-600',
      },
      {
        key: 'position',
        label: 'Position',
        description: 'Check class & general position',
        icon: <Trophy className="w-6 h-6" />,
        tone: 'from-fuchsia-500/20 to-violet-500/10 text-purple-600',
      },
      {
        key: 'finance',
        label: 'Finance',
        description: 'View fees & payments',
        icon: <CreditCard className="w-6 h-6" />,
        tone: 'from-emerald-500/20 to-teal-500/10 text-emerald-600',
      },
      {
        key: 'attendance',
        label: 'Attendance',
        description: 'Track attendance records',
        icon: <CalendarCheck className="w-6 h-6" />,
        tone: 'from-sky-500/20 to-indigo-500/10 text-blue-600',
      },
    ];

  const openStudentMode = () => {
    setStudentModeEntering(true);
    window.setTimeout(() => {
      setStudentModeEntering(false);
      setIsStudentMode(true);
    }, 750);
  };

  if (studentModeEntering) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-800 to-fuchsia-700 flex items-center justify-center">
        <div className="text-center text-white space-y-4 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 rounded-full border-4 border-white/20 border-t-white animate-spin mx-auto" />
          <p className="text-xl font-bold">Opening Student Learning Mode…</p>
          <p className="text-sm text-white/80">Preparing quizzes and leaderboard</p>
        </div>
      </div>
    );
  }

  if (isStudentMode && token && student) {
    return (
      <StudentLearningMode
        key={`${student.admission_number}-${token}`}
        token={token}
        student={student as any}
        onExit={() => setIsStudentMode(false)}
        liveSignal={studentModeSignal}
      />
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F8F7FF] bg-[radial-gradient(circle_at_top_left,rgba(192,132,252,0.34),transparent_32%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.20),transparent_28%),linear-gradient(180deg,#FFFFFF_0%,#F8F7FF_45%,#F4EEFF_100%)] text-slate-950">
      {newQuizPopup && (
        <div className="fixed inset-0 z-[90] bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border shadow-2xl p-5">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">New Teacher Quiz</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{newQuizPopup.title}</p>
            <p className="text-sm text-slate-600 mt-1">
              {newQuizPopup.teacherName ? `From ${newQuizPopup.teacherName}` : 'From your teacher'}
              {newQuizPopup.dueDate ? ` · Due ${newQuizPopup.dueDate}` : ''}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border text-sm font-semibold"
                onClick={() => setNewQuizPopup(null)}
              >
                Later
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
                onClick={() => {
                  setNewQuizPopup(null);
                  openStudentMode();
                }}
              >
                Start Quiz
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Native mobile-inspired top bar ── */}
      <header className="fixed inset-x-0 top-0 z-[100] border-b border-white/40 bg-white/85 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <button
            onClick={() => {
              if (linkedAccounts.length > 1) setShowSwitcher(true);
            }}
            className={`flex min-w-0 items-center gap-3 rounded-3xl text-left transition-transform active:scale-[0.98] ${linkedAccounts.length > 1 ? '' : 'cursor-default'}`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/70 shadow-[0_12px_35px_rgba(139,92,246,0.18)] backdrop-blur-xl">
              {resolvedLogo
                ? <img src={resolvedLogo} alt="" className="h-full w-full object-contain p-1" />
                : <GraduationCap className="h-5 w-5 text-violet-600" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight text-slate-950">{greeting}</p>
              {linkedAccounts.length > 1 ? (
                <p className="truncate text-xs font-semibold text-slate-500">
                  Tap to switch between {linkedAccounts.length} children
                </p>
              ) : null}
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-3">
            <button
              ref={notifBellRef}
              type="button"
              onClick={() => setShowNotifPanel((v) => !v)}
              className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/65 text-slate-800 shadow-[0_14px_32px_rgba(15,23,42,0.10)] backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:bg-white/90 active:scale-95"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/65 text-slate-800 shadow-[0_14px_32px_rgba(15,23,42,0.10)] backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:text-rose-600 active:scale-95"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Desktop tab bar */}
        <div className="hidden max-w-6xl gap-2 overflow-x-auto px-6 pb-3 sm:mx-auto sm:flex scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${activeTab === t.key
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25'
                  : 'bg-white/55 text-slate-500 hover:bg-white/80 hover:text-violet-700'
                }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {t.icon}
                {t.label}
                {t.key === 'desk' && parentDeskUnread > 0 && (
                  <span className="min-h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
                    {parentDeskUnread > 9 ? '9+' : parentDeskUnread}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </header>

      {showNotifPanel && (
        <div
          ref={notifPanelRef}
          className="fixed z-[110] left-3 right-3 top-[4.75rem] sm:left-auto sm:right-6 sm:top-[7rem] sm:w-[min(100vw-2rem,22rem)] max-w-[22rem] sm:ml-auto sm:mr-0 max-h-[min(70dvh,28rem)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-200 origin-top"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            {appNotifications.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (token) {
                    await parentFetch('/parent/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }, token).catch(() => undefined);
                  }
                  setAppNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            {appNotifications.length === 0 ? (
              <p className="text-sm text-slate-500 px-2 py-6 text-center">No notifications yet.</p>
            ) : (
              <ul className="space-y-1">
                {appNotifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (token && n.serverId && !n.read) {
                          await parentFetch(`/parent/notifications/${n.serverId}/read`, { method: 'POST', body: JSON.stringify({}) }, token).catch(() => undefined);
                        }
                        setAppNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
                        if (isFinanceStatementNotification(n)) {
                          await openFinanceStatementFromNotification({ ...n, read: true });
                          return;
                        }
                        setSelectedNotification({ ...n, read: true });
                        setShowNotifPanel(false);
                      }}
                      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all active:scale-[0.99] ${n.read
                          ? 'border-slate-100 bg-white hover:bg-slate-50'
                          : 'border-indigo-200 bg-indigo-50 shadow-sm ring-1 ring-indigo-100'
                        }`}
                    >
                      <p className={`text-sm leading-snug ${n.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>{n.title}</p>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${n.read ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(n.at).toLocaleString()}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <main className="relative z-10 max-w-6xl mx-auto px-3.5 sm:px-6 pt-24 pb-28 sm:pt-32 sm:pb-8">

        {/* Change password banner */}
        {!mustChangePassword && student.must_change_password && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-sm font-medium">You are using your default password. Please change it for security.</p>
            </div>
            <button
              onClick={() => setMustChangePassword(true)}
              className="shrink-0 text-xs font-medium bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors"
            >
              Change Now
            </button>
          </div>
        )}

        {/* ── Overview tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            {/* Student profile card */}
            <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/45 p-[1px] shadow-[0_24px_80px_rgba(139,92,246,0.22)] backdrop-blur-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-400/50 via-white/10 to-pink-400/45 opacity-80" />
              <div className="relative rounded-[calc(2rem-1px)] border border-white/60 bg-white/58 p-4 backdrop-blur-2xl sm:p-5">
                <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-fuchsia-300/30 blur-3xl" />
                <div className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-violet-300/35 blur-3xl" />
                <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <button
                    onClick={() => studentPhotoUrl && setLightboxUrl(studentPhotoUrl)}
                    className={`group shrink-0 ${studentPhotoUrl ? 'cursor-pointer' : 'cursor-default'}`}
                    title={studentPhotoUrl ? 'Click to view full photo' : undefined}
                  >
                    <div className="h-36 w-28 overflow-hidden rounded-[1.6rem] border border-white/80 bg-gradient-to-br from-violet-200 to-pink-100 p-1 shadow-[0_18px_45px_rgba(139,92,246,0.25)]">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.25rem] bg-white/50 text-3xl font-black text-violet-600">
                        {studentPhotoUrl
                          ? <img src={studentPhotoUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          : `${student.first_name[0]}${student.last_name[0]}`}
                      </div>
                    </div>
                  </button>

                  <div className="min-w-0 flex-1 pt-2 flex flex-col items-center sm:items-start">
                    <h2 className="text-2xl font-black leading-tight tracking-tight text-slate-950 text-center sm:text-left">{studentFullName}</h2>
                    <p className="mt-2 text-sm font-medium text-slate-500 text-center sm:text-left">Student ID: {student.admission_number}</p>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-white/70 px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm">
                        <Trophy className="h-3.5 w-3.5" /> {student.class_name}
                      </span>
                      {student.gender && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-white/70 px-3 py-1.5 text-xs font-bold capitalize text-slate-600 shadow-sm">
                          {student.gender}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-gradient-to-r from-amber-100 to-yellow-200 px-3 py-1.5 text-xs font-black text-amber-900 shadow-sm">
                        <Medal className="h-3.5 w-3.5" /> {scholarshipLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-white/70 pt-4">
                  {[
                    { label: 'School', value: student.school_name || schoolName || 'Sacred Hearts School', icon: <Home className="h-3.5 w-3.5" /> },
                    { label: 'Academic Year', value: student.current_year || '2026', icon: <CalendarCheck className="h-3.5 w-3.5" /> },
                    { label: 'Current Term', value: student.current_term || 'Term 3 2026', icon: <CalendarCheck className="h-3.5 w-3.5" /> },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/70 bg-white/45 p-3 shadow-sm backdrop-blur-xl">
                      <p className="flex items-center gap-1.5 text-[10px] font-bold text-violet-500">
                        {item.icon}
                        {item.label}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs font-black leading-tight text-slate-950 sm:text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Continue Learning */}
            <section className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/62 p-4 shadow-[0_14px_38px_rgba(139,92,246,0.14)] backdrop-blur-2xl">
              <div className="absolute -right-8 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full border border-white/60" />
              <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_12px_28px_rgba(139,92,246,0.28)]">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black tracking-tight text-slate-950">Continue Learning</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">Tap to let {student.first_name} study</p>
                    <p className="mt-1 text-[11px] font-bold text-orange-500">🔥 Daily practice available</p>
                  </div>
                </div>
                <button
                  onClick={openStudentMode}
                  className="w-full sm:w-auto text-center shrink-0 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 px-4 py-2.5 sm:py-2 text-xs font-black text-white shadow-[0_12px_28px_rgba(139,92,246,0.30)] transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  Enter →
                </button>
              </div>
            </section>

            {/* Birthday */}
            {birthdayInfo?.birthdays && birthdayInfo.birthdays.length > 0 && birthdayInfo.birthdays.map((bday) => (
              <section key={bday.id} className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50/60 to-pink-50/40 p-4 shadow-[0_14px_38px_rgba(251,191,36,0.18)] backdrop-blur-2xl">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-300/30 blur-3xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_12px_28px_rgba(251,191,36,0.30)]">
                    <Cake className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-black tracking-tight text-slate-950">
                      Happy Birthday, {bday.fullName}! 🎂
                    </p>
                    <p className="text-sm font-medium text-amber-700">
                      Turning {bday.age} today! Wishing you a fantastic year ahead!
                    </p>
                  </div>
                </div>
              </section>
            ))}

            {/* Quick Actions */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.key}
                  onClick={() => handleTabChange(action.key)}
                  className="group relative min-h-[126px] overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/58 p-4 text-left shadow-[0_14px_38px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(139,92,246,0.18)] active:scale-[0.98]"
                >
                  <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${action.tone} shadow-lg shadow-violet-500/10`}>
                    {action.icon}
                  </div>
                  <p className="text-sm font-black text-slate-950">{action.label}</p>
                  <p className="mt-1 max-w-[8.5rem] text-xs font-medium leading-snug text-slate-500">{action.description}</p>
                  <span className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-violet-500 shadow-sm transition-transform group-hover:translate-x-0.5">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </section>

            {/* Admission Letter */}
            <section className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/62 p-4 shadow-[0_14px_38px_rgba(139,92,246,0.14)] backdrop-blur-2xl">
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_12px_28px_rgba(251,146,60,0.28)]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <p className="text-base font-black tracking-tight text-slate-950">Admission Letter</p>
                </div>
                {admissionLetters.length === 0 ? (
                  <p className="text-xs font-medium text-slate-500">No admission letter available yet.</p>
                ) : (
                  <div className="space-y-2">
                    {admissionLetters.map((letter) => (
                      <div key={letter.id} className="flex items-center justify-between p-2 border border-white/70 rounded-xl bg-white/40">
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            v{letter.version_number}
                            {letter.reference_number && <span className="text-xs font-medium text-slate-500 ml-2">· {letter.reference_number}</span>}
                          </p>
                          <p className="text-[10px] text-slate-400">{formatDisplayDate(letter.created_at)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const data = await parentFetch(`/parent/admission-letters/${letter.id}/download`, {}, token) as AdmissionLetterData;
                                setSelectedAdmissionLetter(null);
                                setTimeout(() => setSelectedAdmissionLetter(data), 50);
                              } catch { }
                            }}
                            className="rounded-xl border border-white/70 bg-white/60 px-3 py-1.5 text-[10px] font-bold text-violet-700 hover:bg-white transition-all"
                          >
                            Preview
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const data = await parentFetch(`/parent/admission-letters/${letter.id}/download`, {}, token) as AdmissionLetterData;
                                setSelectedAdmissionLetter(data);
                                setTimeout(() => printAdmissionLetter(), 300);
                              } catch { }
                            }}
                            className="rounded-xl border border-white/70 bg-white/60 px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-white transition-all"
                          >
                            Print
                          </button>
                        </div>
                      </div>
                    ))}
                    {selectedAdmissionLetter && (
                      <div className="mt-4">
                        <AdmissionLetterDocument data={selectedAdmissionLetter} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ── Grades tab ── */}
        {activeTab === 'grades' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" /> Grade Summary
              </h2>
              <button onClick={refreshTab} disabled={dataLoading} className="text-gray-400 hover:text-purple-600 transition-colors">
                <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {showTabLoading ? (
              <LoadingCard logoUrl={schoolLogoUrl ?? student?.school_logo_url} onRetry={refreshTab} />
            ) : !grades?.grades?.length ? (
              <EmptyCard icon={<BookOpen className="w-10 h-10 text-gray-300" />} message="No grades recorded yet." />
            ) : (() => {
              const bySubject: Record<string, any[]> = {};
              for (const g of grades.grades) {
                if (!bySubject[g.subject]) bySubject[g.subject] = [];
                bySubject[g.subject].push(g);
              }
              return (
                <div className="space-y-4">
                  {Object.entries(bySubject).map(([subj, glist]) => {
                    const totalScore = glist.reduce((s, g) => s + parseFloat(g.score), 0);
                    const totalMax = glist.reduce((s, g) => s + parseFloat(g.max_score), 0);
                    const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
                    const lg = getLetterGrade(pct);
                    return (
                      <div key={subj} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Subject header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-gray-100">
                          <div>
                            <h3 className="font-semibold text-gray-800 text-sm">{subj}</h3>
                            <p className="text-xs text-gray-400">{glist.length} assessment{glist.length !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-700">{totalScore}/{totalMax}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${lg.color}`}>{lg.letter}</span>
                            <span className="text-xs text-gray-500 font-medium">{pct}%</span>
                          </div>
                        </div>
                        {/* Score bar */}
                        <div className="px-4 pt-2 pb-1">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        {/* Assessment rows */}
                        <div className="divide-y divide-gray-50">
                          {glist.map((g, i) => {
                            const p = Math.round((parseFloat(g.score) / parseFloat(g.max_score)) * 100);
                            const gl2 = getLetterGrade(p);
                            return (
                              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                                <div>
                                  <p className="text-sm text-gray-700 font-medium">{g.assignment_name}</p>
                                  <p className="text-xs text-gray-400 capitalize">{g.assignment_type}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-bold text-gray-800">
                                    {parseFloat(g.score)}<span className="text-gray-400 font-normal">/{parseFloat(g.max_score)}</span>
                                  </span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ${gl2.color}`}>{gl2.letter}</span>
                                  <span className="text-xs text-gray-400 w-9 text-right">{p}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Position tab ── */}
        {activeTab === 'position' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" /> Terminal Report
              </h2>
              <div className="flex items-center gap-2">
                {termReport?.report && (
                  <button
                    type="button"
                    onClick={handlePrintReportCard}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Print Report Card
                  </button>
                )}
                <button onClick={refreshTab} disabled={dataLoading} className="text-gray-400 hover:text-purple-600 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {showTabLoading ? (
              <LoadingCard logoUrl={schoolLogoUrl ?? student?.school_logo_url} onRetry={refreshTab} />
            ) : !termReport?.report ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">{termReport?.message || 'No report data available.'}</p>
                <p className="text-xs text-gray-400 mt-1">Check back after your teacher releases the report.</p>
              </div>
            ) : (() => {
              const { report } = termReport;
              const myRecord = report.students.find((s: any) => s.isCurrentStudent);
              if (!myRecord) return null;

              const bece = calculateBECE(myRecord.subjectScores);
              const photoUrl = resolveMediaUrl(myRecord.passportPhotoUrl);
              const parsedRemarks = parseTeacherRemarkDetails(report.teacherRemark || '');

              return (
                <div className="space-y-4">
                  {/* Beautiful Report Card Container */}
                  <div
                    ref={reportCardRef}
                    className="bg-white text-slate-950 p-6 md:p-8 border-2 border-black rounded shadow-lg max-w-4xl mx-auto space-y-4"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  >
                    {/* Header Layout */}
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-none">
                          {/* School Logo */}
                          <td className="w-20 align-middle border-none p-0">
                            <div className="w-20 h-20 border-2 border-black inline-block overflow-hidden bg-slate-100">
                              {resolvedLogo ? (
                                <img
                                  src={resolvedLogo}
                                  alt="School Logo"
                                  className="w-full h-full object-contain p-1"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">LOGO</div>
                              )}
                            </div>
                          </td>

                          {/* School Info */}
                          <td className="text-center align-middle border-none px-4 p-0">
                            <h1 className="text-2xl font-black uppercase tracking-normal m-0" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                              {report.schoolName || student?.school_name || 'School'}
                            </h1>
                          </td>

                          {/* Student Photo */}
                          <td className="w-20 align-middle border-none text-right p-0">
                            <div className="w-20 h-24 border-2 border-black inline-block overflow-hidden bg-slate-100">
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={`${myRecord.firstName} ${myRecord.lastName}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">PHOTO</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Title Box */}
                    <div className="border-2 border-black py-1 px-8 text-center font-bold tracking-widest text-base uppercase my-2 max-w-xs mx-auto">
                      TERMINAL REPORT SHEET
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 mb-4 text-xs">
                      <div className="flex items-center">
                        <span className="font-bold uppercase min-w-[130px]">NAME:</span>
                        <span className="flex-grow border-b border-black font-extrabold text-sm pl-2 uppercase">{myRecord.firstName} {myRecord.lastName}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-bold uppercase min-w-[130px]">BASIC:</span>
                        <span className="flex-grow border-b border-black font-extrabold text-sm pl-2 uppercase">{report.className}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-bold uppercase min-w-[130px]">ACADEMIC YEAR:</span>
                        <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{report.currentYear}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-bold uppercase min-w-[130px]">TERM:</span>
                        <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{report.currentTerm}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-bold uppercase min-w-[130px]">POSITION:</span>
                        <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{positionSuffix(myRecord.position)}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-bold uppercase min-w-[130px]">TOTAL MARKS:</span>
                        <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{myRecord.grandTotal}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-bold uppercase min-w-[130px]">NO. ON ROLL:</span>
                        <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{report.totalStudents}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-bold uppercase min-w-[130px]">REOPENING DATE:</span>
                        <span className="flex-grow border-b border-black font-extrabold text-sm pl-2 uppercase">{parsedRemarks.reopeningDate}</span>
                      </div>
                    </div>

                    {/* Subjects Table */}
                    <table className="w-full border-collapse mb-4 text-xs border-all">
                      <thead>
                        <tr>
                          <th className="border-2 border-black bg-slate-50 p-2 text-left font-bold uppercase w-1/3">SUBJECTS</th>
                          <th className="border-2 border-black bg-slate-50 p-2 font-bold uppercase w-20">Class Score<br />40%</th>
                          <th className="border-2 border-black bg-slate-50 p-2 font-bold uppercase w-20">Exams Score<br />60%</th>
                          <th className="border-2 border-black bg-slate-50 p-2 font-bold uppercase w-20">Total Score<br />100%</th>
                          <th className="border-2 border-black bg-slate-50 p-2 font-bold uppercase w-14">Grade</th>
                          <th className="border-2 border-black bg-slate-50 p-2 font-bold uppercase w-16">Position</th>
                          <th className="border-2 border-black bg-slate-50 p-2 font-bold uppercase">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.subjects.map((subj: string) => {
                          const sScore = myRecord.subjectScores[subj];
                          const gr = sScore ? getGhanaianGradeInfo(sScore.score) : { grade: '', remark: '—' };

                          // Calculate position in subject
                          const sortedList = [...report.students].sort((a, b) => (b.subjectScores[subj]?.score || 0) - (a.subjectScores[subj]?.score || 0));
                          let subPos = 1;
                          for (let i = 0; i < sortedList.length; i++) {
                            if (sortedList[i].studentId === myRecord.studentId) {
                              break;
                            }
                            if (sortedList[i].subjectScores[subj]?.score > (sScore?.score || 0)) {
                              subPos++;
                            }
                          }

                          return (
                            <tr key={subj}>
                              <td className="border-2 border-black p-2 font-bold text-left uppercase">{subj}</td>
                              <td className="border-2 border-black p-2 font-bold text-center">{sScore ? sScore.classScore?.toFixed(1) : '—'}</td>
                              <td className="border-2 border-black p-2 font-bold text-center">{sScore ? sScore.examScore?.toFixed(1) : '—'}</td>
                              <td className="border-2 border-black p-2 font-extrabold text-center">{sScore ? sScore.score?.toFixed(1) : '—'}</td>
                              <td className="border-2 border-black p-2 font-bold text-center">{gr.grade}</td>
                              <td className="border-2 border-black p-2 font-bold text-center">{sScore ? positionSuffix(subPos) : '—'}</td>
                              <td className="border-2 border-black p-2 font-bold uppercase text-[10px] text-left">{gr.remark}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Remarks Section */}
                    <div className="space-y-3 mb-4">
                      <div className="flex flex-wrap items-center gap-y-2 text-xs">
                        <span className="font-bold uppercase min-w-[100px]">ATTENDANCE:</span>
                        <span className="border-b border-black font-bold pl-2 w-16 text-center">{parsedRemarks.attendance || '—'}</span>

                        <span className="font-bold uppercase mx-2">OUT OF:</span>
                        <span className="border-b border-black font-bold pl-2 w-16 text-center">{parsedRemarks.attendanceOutOf || '—'}</span>

                        <span className="font-bold uppercase mx-2">PROMOTED TO:</span>
                        <span className="flex-grow border-b border-black font-bold pl-2 uppercase">{parsedRemarks.promotedTo || '—'}</span>
                      </div>

                      <div className="flex items-center text-xs">
                        <span className="font-bold uppercase min-w-[100px]">CONDUCT:</span>
                        <span className="flex-grow border-b border-black font-bold pl-2 uppercase">{parsedRemarks.conduct}</span>
                      </div>

                      <div className="flex items-center text-xs">
                        <span className="font-bold uppercase min-w-[100px]">ATTITUDE:</span>
                        <span className="flex-grow border-b border-black font-bold pl-2 uppercase">{parsedRemarks.attitude}</span>
                      </div>

                      <div className="flex items-center text-xs">
                        <span className="font-bold uppercase min-w-[100px]">INTEREST:</span>
                        <span className="flex-grow border-b border-black font-bold pl-2 uppercase">{parsedRemarks.interest}</span>
                      </div>

                      <div className="flex items-start text-xs">
                        <span className="font-bold uppercase min-w-[180px] pt-1">CLASS TEACHER'S REMARKS:</span>
                        <span className="flex-grow border-b border-black font-bold pl-2 uppercase">{parsedRemarks.text || '—'}</span>
                      </div>

                      {report.headmasterRemark && (
                        <div className="flex items-start text-xs">
                          <span className="font-bold uppercase min-w-[180px] pt-1">HEADMASTER'S REMARKS:</span>
                          <span className="flex-grow border-b border-black font-bold pl-2 uppercase">{report.headmasterRemark || '—'}</span>
                        </div>
                      )}
                    </div>
                    {/* Signatures Area */}
                    <div className="grid grid-cols-2 gap-12 mt-12 mb-4 text-center text-xs">
                      <div className="flex flex-col items-center">
                        <div className="h-12" />
                        <div className="w-full border-t border-black pt-1 font-bold uppercase text-[10px] tracking-wider">
                          CLASS TEACHER'S SIGNATURE
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="h-12" />
                        <div className="w-full border-t border-black pt-1 font-bold uppercase text-[10px] tracking-wider">
                          HEAD TEACHER'S SIGNATURE
                        </div>
                      </div>
                    </div>

                    {/* Grading Scale Legend */}
                    <div className="border-t border-black pt-3 mb-3">
                      <p className="font-extrabold uppercase text-center text-[10px] tracking-wider mb-2">GRADING SCALE</p>
                      <div className="grid grid-cols-3 gap-y-1.5 gap-x-2 text-[9px] font-bold">
                        <div>Grade A &nbsp; 80 - 100 &nbsp; <span className="italic text-slate-600">Excellent</span></div>
                        <div>Grade B &nbsp; 70 - 79 &nbsp; <span className="italic text-slate-600">Very Good</span></div>
                        <div>Grade C &nbsp; 60 - 69 &nbsp; <span className="italic text-slate-600">Good</span></div>
                        <div>Grade D &nbsp; 45 - 59 &nbsp; <span className="italic text-slate-600">Credit</span></div>
                        <div>Grade E &nbsp; 35 - 44 &nbsp; <span className="italic text-slate-600">Pass</span></div>
                        <div>Grade F &nbsp; Below 35 &nbsp; <span className="italic text-slate-600">Fail</span></div>
                      </div>
                    </div>

                    {/* BECE AGGREGATE CALCULATION */}
                    <div className="border-t border-black pt-3">
                      <p className="font-extrabold uppercase text-center text-[10px] tracking-wider mb-2">BECE AGGREGATE CALCULATION</p>
                      <div className="grid grid-cols-2 gap-4 text-[10px]">
                        <div>
                          <p className="font-bold text-slate-800 underline mb-1">Core Subjects:</p>
                          <div className="flex justify-between max-w-xs font-semibold mb-0.5"><span>English</span> <span>Grade {bece.cores.english}</span></div>
                          <div className="flex justify-between max-w-xs font-semibold mb-0.5"><span>Science</span> <span>Grade {bece.cores.science}</span></div>
                          <div className="flex justify-between max-w-xs font-semibold mb-0.5"><span>MATHS</span> <span>Grade {bece.cores.maths}</span></div>
                          <div className="flex justify-between max-w-xs font-semibold mb-0.5"><span>Social</span> <span>Grade {bece.cores.social}</span></div>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 underline mb-1">Best 2 Electives:</p>
                          {bece.bestElectives.map((val, idx) => (
                            <div key={idx} className="flex justify-between max-w-xs font-semibold mb-0.5">
                              <span>Elective {idx + 1}</span> <span>Grade {val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-center font-extrabold uppercase text-xs mt-3 tracking-wide">
                        AGGREGATE: <span className="text-sm text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded ml-1 font-mono">{bece.aggregate}</span>
                      </div>
                    </div>

                    <div className="footer-text mt-4 border-t border-slate-200 pt-2 text-[8px] text-center text-slate-500 uppercase tracking-widest">
                      Generated by ScholarNerve
                    </div>

                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Finance tab ── */}
        {activeTab === 'finance' && (
          <div className="space-y-4">
            {unreadFinanceStatementCount > 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-900">New finance statement from school</p>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        {unreadFinanceStatementCount === 1
                          ? 'A finance statement is ready for you to review and download.'
                          : `${unreadFinanceStatementCount} finance statement alerts are waiting.`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFinanceStatementOpen(true)}
                    className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
                  >
                    View Statement
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-600" /> Fee Balance
              </h2>
              <div className="flex items-center gap-2">
                {token ? (
                  <button
                    type="button"
                    onClick={() => setFinanceStatementOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Finance Statement
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void refreshFinanceAll()}
                  disabled={isSwitchingStudent || dataLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  title="Refresh balance, receipts, and payments"
                >
                  <RefreshCw className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`} />
                  Refresh All
                </button>
              </div>
            </div>

            {showTabLoading ? (
              <LoadingCard logoUrl={schoolLogoUrl ?? student?.school_logo_url} onRetry={refreshTab} />
            ) : !finance ? (
              <EmptyCard icon={<CreditCard className="w-10 h-10 text-gray-300" />} message="No finance data available." />
            ) : (
              <div className="space-y-4">
                {student.is_beneficiary && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                      <Medal className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-amber-900">Discount ({student.discount_type === 'percentage' ? `${student.discount_value || 0}%` : `GHS ${(student.discount_value || 0).toLocaleString()}`})</p>
                        <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                      </div>
                      <p className="text-xs text-amber-800 mt-1">
                        A discount of <strong className="font-black">{student.discount_type === 'percentage' ? `${student.discount_value}%` : GH(student.discount_value || 0)}</strong> has been applied to the tuition fees for your ward.
                      </p>
                      {student.beneficiary_notes && (
                        <p className="text-[10px] text-amber-700 mt-2 bg-white/50 p-2 rounded-lg italic">
                          <span className="font-bold not-italic">Note:</span> {student.beneficiary_notes}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Balance card */}
                {(() => {
                  const portalStatus = finance.status as 'unpaid' | 'paid' | 'credit' | 'not_set';
                  const outstanding = Number(finance.outstanding ?? finance.balance ?? 0);
                  const credit = Number(finance.credit ?? 0);
                  const termLabel = finance.currentTermLabel || finance.currentTerm || '';
                  const cardClass =
                    portalStatus === 'paid' ? 'bg-gradient-to-br from-green-500 to-emerald-700'
                      : portalStatus === 'credit' ? 'bg-gradient-to-br from-blue-500 to-indigo-700'
                        : portalStatus === 'not_set' ? 'bg-gradient-to-br from-slate-500 to-slate-700'
                          : 'bg-gradient-to-br from-red-500 to-rose-700';
                  const badgeClass =
                    portalStatus === 'paid' ? 'bg-green-400/30 text-green-100'
                      : portalStatus === 'credit' ? 'bg-blue-400/30 text-blue-100'
                        : portalStatus === 'not_set' ? 'bg-white/20 text-white/90'
                          : 'bg-red-400/30 text-red-100';
                  const badgeLabel =
                    portalStatus === 'paid' ? '✓ Paid'
                      : portalStatus === 'credit' ? 'Credit'
                        : portalStatus === 'not_set' ? 'No Fee Set'
                          : 'Unpaid';
                  const headlineAmount = portalStatus === 'credit' ? credit : Math.max(0, outstanding);
                  const headlineLabel = portalStatus === 'credit' ? 'Credit Balance' : 'Outstanding Balance';

                  return (
                    <div className={`rounded-2xl p-5 text-white shadow-lg ${cardClass}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">
                            {finance.schoolName || student.school_name}
                          </p>
                          <p className="text-white/70 text-xs mb-1">{termLabel}</p>
                          <p className="text-3xl font-black mt-1">{GH(headlineAmount)}</p>
                          <p className="text-white/80 text-sm mt-1">{headlineLabel}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
                        <div className="text-center">
                          <p className="text-white/60 text-[10px] uppercase tracking-wide">Total Term Bill</p>
                          <TermBillBreakdown
                            total={Number(finance.termFee ?? 0)}
                            credit={Number(finance.feeBreakdown?.credit ?? finance.credit ?? 0)}
                            breakdownItems={(finance.feeBreakdown?.termFeeLines || []).map((line: { label: string; amount: number }) => ({
                              label: line.label,
                              amount: line.amount,
                            }))}
                            individualCharges={finance.individualChargeLines}
                            compact
                            className="mt-0.5 text-white [&_button]:text-white/80 [&_span]:text-white [&_.font-mono]:text-white"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-white/60 text-[10px] uppercase tracking-wide">Arrears</p>
                          <p className="text-xs sm:text-sm font-bold mt-0.5">{GH(Number(finance.arrears ?? 0))}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white/60 text-[10px] uppercase tracking-wide">Paid</p>
                          <p className="text-xs sm:text-sm font-bold mt-0.5">{GH(Number(finance.totalPaid ?? 0))}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Fee breakdown */}
                {finance.feeBreakdown && (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-800 text-sm">
                        Fee Breakdown — {finance.feeBreakdown.termLabel || finance.currentTerm}
                      </h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {(finance.feeBreakdown.termFeeLines || []).map((line: { label: string; amount: number }) => (
                        <div key={line.label} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm text-gray-600">{line.label}</span>
                          <span className="text-sm font-semibold text-gray-800">{GH(Number(line.amount || 0))}</span>
                        </div>
                      ))}
                      {(finance.liveBreakdown?.individualChargeLines || []).length > 0 && (
                        <>
                          {(finance.liveBreakdown.individualChargeLines || []).map((charge: { id: number; description: string; amount: number; reason: string | null; status: string }) => (
                            <div key={`charge-${charge.id}`} className="flex items-center justify-between px-4 py-2.5 bg-blue-50/50">
                              <div className="text-sm flex-1">
                                <div className="text-blue-700 font-medium">{charge.description}</div>
                                {charge.reason && <div className="text-xs text-blue-600 mt-0.5">{charge.reason}</div>}
                              </div>
                              <span className="text-sm font-semibold text-blue-700 ml-2">{GH(Number(charge.amount || 0))}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {Number(finance.feeBreakdown.discountAmount || finance.discountAmount || 0) > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50">
                          <span className="text-sm text-amber-700 flex items-center gap-1.5">
                            <Medal className="w-3.5 h-3.5" /> Discount
                          </span>
                          <span className="text-sm font-bold text-amber-700">
                            -{GH(Number(finance.feeBreakdown.discountAmount || finance.discountAmount || 0))}
                          </span>
                        </div>
                      )}
                      {(finance.feeBreakdown.arrearLines || []).map((line: { termName: string; amount: number }) => (
                        <div key={line.termName} className="flex items-center justify-between px-4 py-2.5 bg-red-50/70">
                          <span className="text-sm text-red-700 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Arrears — {line.termName}
                          </span>
                          <span className="text-sm font-semibold text-red-700">{GH(Number(line.amount || 0))}</span>
                        </div>
                      ))}
                      {Number(finance.feeBreakdown.credit ?? finance.credit ?? 0) > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/70">
                          <span className="text-sm text-blue-700">Credit</span>
                          <span className="text-sm font-semibold text-blue-700">-{GH(Number(finance.feeBreakdown.credit ?? finance.credit ?? 0))}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm font-medium text-gray-700">Total Due</span>
                        <span className="text-sm font-bold text-gray-800">{GH(Number(finance.feeBreakdown.totalDue ?? finance.totalDue ?? 0))}</span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm font-medium text-gray-700">Amount Paid (this term)</span>
                        <span className="text-sm font-semibold text-emerald-700">{GH(Number(finance.feeBreakdown.totalPaid ?? finance.totalPaid ?? 0))}</span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                        <span className="text-sm font-bold text-gray-800">
                          {Number(finance.feeBreakdown.credit ?? finance.credit ?? 0) > 0 ? 'Credit' : 'Outstanding'}
                        </span>
                        <span className="text-sm font-bold text-gray-800">
                          {Number(finance.feeBreakdown.credit ?? finance.credit ?? 0) > 0
                            ? GH(Number(finance.feeBreakdown.credit ?? finance.credit ?? 0))
                            : GH(Number(finance.feeBreakdown.outstanding ?? finance.outstanding ?? finance.balance ?? 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment history */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 text-sm">Payment History</h3>
                    <span className="text-xs text-gray-400">{finance.payments.length} payment{finance.payments.length !== 1 ? 's' : ''}</span>
                  </div>
                  {finance.payments.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">No payments recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                      {finance.payments.map((p: any) => {
                        const activeTerm = finance.currentTermLabel || finance.currentTerm || '';
                        const isCurrentTerm =
                          !p.term || p.term === '—' ||
                          String(p.term).toLowerCase() === String(activeTerm).toLowerCase() ||
                          String(p.term).toLowerCase().includes(String(activeTerm).toLowerCase()) ||
                          String(activeTerm).toLowerCase().includes(String(p.term).toLowerCase());
                        const paymentStatus = p.status === 'corrected' ? 'Corrected' : 'Active';
                        return (
                          <div key={p.id ?? `${p.receipt_number}-${p.payment_date}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isCurrentTerm ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-gray-800">{GH(parseFloat(p.amount_paid))}</span>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isCurrentTerm
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {p.term || '—'}
                                  </span>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.status === 'corrected'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {paymentStatus}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 flex items-center gap-1 flex-wrap mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  {fmtDate(p.payment_date)}
                                  {p.payment_method && <><span>·</span> {p.payment_method}</>}
                                  {p.receipt_number && (
                                    <>
                                      <span>·</span>
                                      <button
                                        type="button"
                                        onClick={() => openReceipt(p)}
                                        className="font-medium text-purple-600 hover:text-purple-700 underline underline-offset-2"
                                      >
                                        #{p.receipt_number}
                                      </button>
                                    </>
                                  )}
                                </p>
                                {(p.reference_number || p.notes) && (
                                  <p className="text-[11px] text-gray-500 mt-1 truncate">
                                    {p.reference_number ? `Ref: ${p.reference_number}` : ''}
                                    {p.reference_number && p.notes ? ' · ' : ''}
                                    {p.notes ? `Note: ${p.notes}` : ''}
                                  </p>
                                )}
                                {p.status === 'corrected' && p.replacesReceiptNumber && (
                                  <p className="text-[11px] text-amber-700 mt-1">
                                    Replaces receipt #{p.replacesReceiptNumber}
                                    {p.receipt_updated_at ? ` · updated ${fmtDate(p.receipt_updated_at)}` : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openReceipt(p)}
                              className="w-full sm:w-auto text-center text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 shrink-0"
                            >
                              View Receipt
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Attendance tab ── */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-blue-600" /> Attendance Record
              </h2>
              <button onClick={refreshTab} disabled={dataLoading} className="text-gray-400 hover:text-purple-600 transition-colors">
                <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {showTabLoading ? (
              <LoadingCard logoUrl={schoolLogoUrl ?? student?.school_logo_url} onRetry={refreshTab} />
            ) : !attendance ? (
              <EmptyCard icon={<CalendarCheck className="w-10 h-10 text-gray-300" />} message="No attendance records yet." />
            ) : (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Days Present', val: attendance.summary.present, color: 'text-green-700', bg: 'bg-green-50 border-green-100' },
                    { label: 'Days Absent', val: attendance.summary.absent, color: 'text-red-700', bg: 'bg-red-50 border-red-100' },
                    { label: 'Total Days', val: attendance.summary.total, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-100' },
                    { label: 'Attendance Rate', val: `${attendance.summary.rate}%`, color: attendance.summary.rate >= 75 ? 'text-green-700' : 'text-red-700', bg: attendance.summary.rate >= 75 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100' },
                  ].map(c => (
                    <div key={c.label} className={`${c.bg} border rounded-xl p-3 text-center`}>
                      <p className={`text-2xl font-black ${c.color}`}>{c.val}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* Rate bar */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Attendance Rate</span>
                    <span className={`text-sm font-bold ${attendance.summary.rate >= 75 ? 'text-green-700' : 'text-red-600'}`}>
                      {attendance.summary.rate}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${attendance.summary.rate >= 75 ? 'bg-green-500' : attendance.summary.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${attendance.summary.rate}%` }}
                    />
                  </div>
                  {attendance.summary.rate < 75 && (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Attendance is below the recommended 75% threshold.
                    </p>
                  )}
                </div>

                {/* Record list */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-blue-600" /> Daily Records
                    </h3>
                  </div>
                  {attendance.records.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">No records found.</div>
                  ) : (
                    <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                      {attendance.records.map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${r.present ? 'bg-green-100' : 'bg-red-100'}`}>
                            {r.present
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-700">{fmtDate(r.attendance_date)}</p>
                            <p className="text-xs text-gray-400">{r.class_name}</p>
                          </div>
                          <span className={`text-xs font-semibold ${r.present ? 'text-green-600' : 'text-red-600'}`}>
                            {r.present ? 'Present' : 'Absent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'desk' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-end">
              <button
                onClick={() => setShowDeskGuide(true)}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
              >
                How to use Parent Desk
              </button>
            </div>
            <div
              className="rounded-2xl border border-white/30 p-4 shadow-lg"
              style={{ background: `linear-gradient(130deg, ${brandPrimary}22 0%, #ffffff 55%, ${brandSecondary}1a 100%)` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-white/60 flex items-center justify-center">
                  {resolvedLogo ? <img src={resolvedLogo} alt="" className="w-full h-full object-contain p-1" /> : <GraduationCap className="w-5 h-5 text-slate-500" />}
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{student.school_name}</p>
                  <p className="text-xs text-slate-500">Direct line to your school support desk</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <a href={`tel:${deskContact?.phone_number || deskContact?.contact_phone || deskContact?.contact || ''}`} className="flex items-center gap-2 text-slate-700 hover:text-slate-900"><Phone className="w-4 h-4" /> {deskContact?.phone_number || deskContact?.contact_phone || deskContact?.contact || 'School phone not set'}</a>
                <a href={`https://wa.me/${String(deskContact?.whatsapp_number || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-700 hover:text-slate-900"><MessageSquare className="w-4 h-4" /> {deskContact?.whatsapp_number || 'WhatsApp not set'}</a>
                <a href={`mailto:${deskContact?.email || ''}`} className="flex items-center gap-2 text-slate-700 hover:text-slate-900"><Mail className="w-4 h-4" /> {deskContact?.email || 'Email not set'}</a>
                <div className="text-xs text-slate-500 pl-6">{deskContact?.office_hours || 'Mon-Fri • 7:00am - 4:00pm'}</div>
                <div className="text-xs text-slate-500 pl-6">{deskContact?.physical_address || deskContact?.address || deskContact?.postal_address || 'School address not set'}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your Conversations</h2>
              <button onClick={() => loadDeskMessages()} className="text-sm text-purple-700 hover:text-purple-800">Refresh</button>
            </div>

            {isSwitchingStudent || deskLoading ? (
              <LoadingCard logoUrl={schoolLogoUrl ?? student?.school_logo_url} onRetry={refreshTab} />
            ) : deskMessages.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
                <MessageSquare className="w-10 h-10 text-purple-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">Have a question or concern?</p>
                <p className="text-xs text-slate-500 mt-1">Your school is just one message away.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deskMessages.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openDeskConversation(Number(m.id))}
                    className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-lg hover:border-purple-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{m.subject}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{m.first_name} {m.last_name} • {m.class_name || 'No class'}</p>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">{formatDisplayDate(m.created_at)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">{m.message}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[11px] px-2 py-1 rounded-full ${m.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                          m.status === 'urgent' ? 'bg-red-100 text-red-700' :
                            m.status === 'in_review' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                        {String(m.status || 'pending').replace('_', ' ')}
                      </span>
                      {(Number(m.unread_replies || 0) > 0) && <span className="text-[11px] text-purple-700 font-semibold animate-pulse">● New Reply</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setDeskComposeOpen(true)}
              className="fixed bottom-24 right-5 sm:bottom-8 sm:right-8 w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center animate-bounce"
              style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})` }}
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-10 hidden border-t border-white/50 py-4 text-center text-xs text-slate-400 sm:block">
        {student.school_name} · Parent Portal · Secure & Private
      </footer>

      {/* Mobile bottom navigation */}
      <nav className="sm:hidden fixed bottom-4 left-5 right-5 z-40 overflow-hidden rounded-[1.875rem] border border-white/75 bg-white/58 px-2.5 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] shadow-[0_22px_65px_rgba(139,92,246,0.24)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/60 via-violet-100/20 to-white/60" />
        <div className="relative grid grid-cols-5 gap-1">
          {mobileTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[9px] xs:text-[10px] font-bold transition-all active:scale-95 ${activeTab === t.key
                  ? 'text-white shadow-[0_12px_28px_rgba(139,92,246,0.35)]'
                  : 'text-slate-500 hover:text-violet-700'
                }`}
              style={activeTab === t.key ? { background: 'linear-gradient(135deg, #8B5CF6, #A855F7 55%, #EC4899)' } : undefined}
            >
              <span className="relative inline-flex">
                {t.icon}
                {t.key === 'desk' && parentDeskUnread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold leading-none text-white ring-2 ring-white">
                    {parentDeskUnread > 9 ? '9' : parentDeskUnread}
                  </span>
                )}
              </span>
              <span className="leading-none">{t.key === 'desk' ? 'Desk' : t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {showInstallPrompt && installPromptEvent && (
        <div className="fixed bottom-20 right-4 z-50 max-w-xs rounded-2xl border border-purple-200 bg-white shadow-2xl p-3">
          <p className="text-sm font-semibold text-slate-800">Install Parent App</p>
          <p className="text-xs text-slate-500 mt-1">
            Add this portal to your home screen for faster access and better notifications.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="flex-1 text-xs font-medium rounded-lg border border-slate-200 px-2 py-2 text-slate-600 hover:bg-slate-50"
            >
              Later
            </button>
            <button
              onClick={handleInstallApp}
              className="flex-1 text-xs font-semibold rounded-lg px-2 py-2 text-white"
              style={{ backgroundColor: brandPrimary }}
            >
              Install
            </button>
          </div>
        </div>
      )}

      {showInstallHelp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-purple-100 bg-white shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
              <p className="text-sm font-semibold">Install Parent App</p>
              <p className="text-xs text-violet-100 mt-0.5">Get faster access and better notifications</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-700">How to install</p>
                <ol className="mt-2 space-y-1 text-xs text-slate-500 list-decimal pl-4">
                  <li>Tap your browser menu (three dots).</li>
                  <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                  <li>Confirm install to place the app icon on your home screen.</li>
                </ol>
              </div>
              <button
                onClick={() => setShowInstallHelp(false)}
                className="w-full rounded-lg py-2 text-sm font-semibold text-white"
                style={{ background: `linear-gradient(90deg, ${brandPrimary}, ${brandSecondary})` }}
              >
                OK, got it
              </button>
            </div>
          </div>
        </div>
      )}

      {deskComposeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="modal w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900">New Parent Desk Message</h3>
              <button onClick={() => setDeskComposeOpen(false)} className="text-slate-500 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {[
                ['absence', '🤒 Absence'],
                ['fee', '💰 Fee Query'],
                ['academic', '📚 Academic'],
                ['teacher', '👨‍🏫 Teacher'],
                ['late', '🚌 Late'],
                ['general', '💬 General'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setDeskType(k as any)}
                  className={`rounded-xl border px-3 py-2 text-sm transition-all ${deskType === k ? 'border-purple-400 bg-purple-50 text-purple-700 scale-[1.01]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Subject</p>
              <p className="text-sm font-semibold text-slate-700">{MESSAGE_TYPE_LABEL[deskType]}</p>
            </div>
            <div className="mt-1">
              <div className="flex items-end gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/90 pl-1.5 pr-1 py-1.5 shadow-inner">
                <input
                  ref={deskComposeFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setDeskAttachment(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => deskComposeFileRef.current?.click()}
                  className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200/80 active:scale-95"
                  aria-label="Attach image"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea
                  value={deskBody}
                  onChange={(e) => setDeskBody(e.target.value)}
                  rows={1}
                  placeholder="Message"
                  className="flex-1 min-w-0 min-h-[44px] max-h-[140px] resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-200/60"
                />
                <button
                  type="button"
                  onClick={() => submitDeskMessage().catch(() => undefined)}
                  disabled={!deskBody.trim()}
                  className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md disabled:opacity-40 disabled:shadow-none active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})` }}
                  aria-label="Send message"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
                <span className="truncate min-h-[1em]">{deskAttachment?.name || ''}</span>
                <span className="shrink-0">{deskBody.length} chars</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDeskMessage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl max-h-[92dvh] overflow-hidden flex flex-col overscroll-contain">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{selectedDeskMessage.subject}</p>
                <p className="text-xs text-slate-500 capitalize">{selectedDeskMessage.type} · {String(selectedDeskMessage.status || '').replace('_', ' ')}</p>
              </div>
              <button onClick={() => setSelectedDeskMessage(null)} className="text-slate-500 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]">
              {/* Parent's original message (own message) should be on the right */}
              <div className="flex justify-end">
                <div className="max-w-[86%] rounded-2xl rounded-br-md px-3 py-2 bg-[#dcf8c6] border border-green-200 text-sm text-slate-700 shadow-sm">
                  <p>{selectedDeskMessage.message}</p>
                  {selectedDeskMessage.attachment_url && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-green-300">
                      <img
                        src={resolveMediaUrl(selectedDeskMessage.attachment_url) || selectedDeskMessage.attachment_url}
                        alt="Attachment"
                        className="max-h-48 w-full object-cover cursor-pointer"
                        onClick={() => setLightboxUrl(selectedDeskMessage.attachment_url)}
                      />
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-slate-500 text-right">{new Date(selectedDeskMessage.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓</div>
                </div>
              </div>
              {deskConversation.map((r) => (
                <div key={r.id} className={`flex ${r.sender_type === 'parent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm shadow-sm ${r.sender_type === 'parent'
                      ? 'bg-[#dcf8c6] border border-green-200 text-slate-700 rounded-br-md'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
                    }`}>
                    <p>{r.reply_text}</p>
                    {r.attachment_url && (
                      <div className={`mt-2 rounded-lg overflow-hidden border ${r.sender_type === 'parent' ? 'border-green-300' : 'border-slate-200'}`}>
                        <img
                          src={resolveMediaUrl(r.attachment_url) || r.attachment_url || ''}
                          alt="Reply Attachment"
                          className="max-h-48 w-full object-cover cursor-pointer"
                          onClick={() => setLightboxUrl(r.attachment_url)}
                        />
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-slate-400 text-right">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{r.sender_type === 'parent' ? ' ✓✓' : ''}</div>
                  </div>
                </div>
              ))}
              <div ref={parentScrollRef} />
            </div>
            <div className="p-3 border-t border-slate-100 bg-slate-50/80">
              <div className="flex items-end gap-1.5 rounded-2xl border border-slate-200 bg-white pl-1.5 pr-1 py-1 shadow-sm">
                <input
                  ref={deskReplyFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setDeskReplyAttachment(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => deskReplyFileRef.current?.click()}
                  className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95"
                  aria-label="Attach image"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea
                  value={deskReply}
                  onChange={(e) => setDeskReply(e.target.value)}
                  rows={1}
                  placeholder="Type a message"
                  className="flex-1 min-w-0 min-h-[44px] max-h-[120px] resize-none rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-200/50"
                />
                <button
                  type="button"
                  onClick={() => submitDeskReply().catch(() => undefined)}
                  disabled={!deskReply.trim()}
                  className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md disabled:opacity-40 disabled:shadow-none active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})` }}
                  aria-label="Send reply"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              {deskReplyAttachment ? (
                <p className="mt-1 truncate px-1 text-[11px] text-slate-500">{deskReplyAttachment.name}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showDeskGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 text-white" style={{ background: `linear-gradient(90deg, ${brandPrimary}, ${brandSecondary})` }}>
              <p className="text-sm font-semibold">Parent Desk Guide</p>
              <p className="text-xs text-white/90 mt-0.5">Quick steps for parents</p>
            </div>
            <div className="p-4 space-y-3 text-sm text-slate-700">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold">1) Tap the + button</p>
                <p className="text-xs text-slate-500 mt-1">Start a new message to your school.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold">2) Choose a category</p>
                <p className="text-xs text-slate-500 mt-1">Absence, Fee Query, Academic, Teacher Concern, Late Arrival or General.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold">3) Write your message and send</p>
                <p className="text-xs text-slate-500 mt-1">You can also attach an image when needed.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold">4) Open conversation cards</p>
                <p className="text-xs text-slate-500 mt-1">Check school replies and continue chat anytime.</p>
              </div>
              <button
                onClick={() => setShowDeskGuide(false)}
                className="w-full rounded-lg py-2 text-sm font-semibold text-white"
                style={{ background: `linear-gradient(90deg, ${brandPrimary}, ${brandSecondary})` }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {token ? (
        <FinanceStatementModal
          key={`${student?.admission_number || 'parent'}-${token}`}
          open={financeStatementOpen}
          onOpenChange={setFinanceStatementOpen}
          parentToken={token}
          studentLabel={student ? `${student.first_name} ${student.last_name}` : undefined}
        />
      ) : null}

      {selectedNotification && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedNotification(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-800">{selectedNotification.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{new Date(selectedNotification.at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="w-8 h-8 rounded-full text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedNotification.message}
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {isFinanceStatementNotification(selectedNotification) ? (
                  <button
                    onClick={() => void openFinanceStatementFromNotification(selectedNotification)}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
                  >
                    View Statement
                  </button>
                ) : null}
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(90deg, ${brandPrimary}, ${brandSecondary})` }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxUrl}
              alt={`${student.first_name} ${student.last_name}`}
              className="w-full rounded-2xl shadow-2xl border-4 border-white/10 object-contain max-h-[80dvh]"
            />
            <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-3">
              <div className="bg-black/50 text-white text-sm font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">
                {student.first_name} {student.last_name}
              </div>
              <button
                onClick={() => setLightboxUrl(null)}
                className="w-8 h-8 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReceipt && (
        <ReceiptPrinter
          receiptData={selectedReceipt}
          show={showReceipt}
          onClose={() => setShowReceipt(false)}
          onPrint={() => undefined}
          schoolNameOverride={student.school_name || schoolName}
          logoUrlOverride={student.school_logo_url || schoolLogoUrl}
        />
      )}

      {/* Account Switcher - Instagram Style Bottom Sheet */}
      {showSwitcher && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowSwitcher(false)}
          />

          {/* Sheet */}
          <div className="relative w-full max-w-lg sm:max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 ease-out">
            {/* Mobile Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="p-5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Switch Account</h3>
              <button
                onClick={() => setShowSwitcher(false)}
                className="hidden sm:block p-1.5 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="max-h-[60dvh] overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-contain px-2 py-2">
              {isSwitchingStudent ? (
                <div className="px-4 py-6 text-center text-sm text-purple-600 font-medium">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Switching student…
                </div>
              ) : null}
              <div className="space-y-1">
                {linkedAccounts.map((acc) => {
                  const isActive = acc.student.admission_number === student.admission_number;
                  return (
                    <button
                      key={acc.student.admission_number}
                      onClick={() => handleSwitchAccount(acc)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 ${isActive
                          ? 'bg-purple-50/50 border border-purple-100'
                          : 'hover:bg-slate-50'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`relative w-14 h-14 rounded-2xl overflow-hidden shadow-sm border-2 transition-all duration-300 ${isActive ? 'border-purple-500 scale-105' : 'border-white'
                          }`}>
                          {acc.student.passport_photo_url ? (
                            <img src={resolveMediaUrl(acc.student.passport_photo_url)!} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-lg">
                              {acc.student.first_name[0]}{acc.student.last_name[0]}
                            </div>
                          )}
                        </div>
                        <div className="text-left">
                          <p className={`font-bold text-sm tracking-tight ${isActive ? 'text-purple-900' : 'text-slate-800'}`}>
                            {acc.student.first_name} {acc.student.last_name}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                            ID: {acc.student.admission_number}
                          </p>
                        </div>
                      </div>
                      {isActive && (
                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-5 bg-slate-50/50 border-t border-slate-100">
              <button
                onClick={() => setShowSwitcher(false)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Shared sub-components ─────────────────────────────────────────────────────

const LoadingCard = ({
  logoUrl,
  active = true,
  onRetry,
}: {
  logoUrl?: string | null;
  active?: boolean;
  onRetry?: () => void;
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
    <BrandedLoading
      logoUrl={logoUrl}
      label="Loading…"
      className="py-2"
      active={active}
      onRetry={onRetry}
    />
  </div>
);

const EmptyCard = ({ icon, message }: { icon: React.ReactNode; message: string }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
    <div className="mx-auto mb-3 flex justify-center">{icon}</div>
    <p className="text-sm text-gray-400">{message}</p>
  </div>
);

// ── Route wrapper ─────────────────────────────────────────────────────────────

import { useParams } from 'react-router-dom';

export const ParentPortalRoute: React.FC = () => {
  const { tenantId: tenantIdParam, slug } = useParams<{ tenantId?: string; slug?: string }>();
  const [tenantId, setTenantId] = React.useState<number | null>(null);
  const [schoolName, setSchoolName] = React.useState('');
  const [schoolLogoUrl, setSchoolLogoUrl] = React.useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = React.useState<string | null>(null);
  const [secondaryColor, setSecondaryColor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [fetchAttempt, setFetchAttempt] = React.useState(0);

  React.useEffect(() => {
    const fetchTenant = async () => {
      setLoading(true);
      try {
        let fetchUrl = '';
        const hostSlug = detectTenantSlugFromHost();
        if (hostSlug) {
          fetchUrl = `${API}/tenant/by-slug/${hostSlug}`;
        } else if (slug) {
          fetchUrl = `${API}/tenant/by-slug/${slug}`;
        } else if (tenantIdParam) {
          // If it's a number, try by ID; otherwise, try as a slug
          if (!isNaN(Number(tenantIdParam)) && /^\d+$/.test(tenantIdParam)) {
            fetchUrl = `${API}/tenant/by-id/${tenantIdParam}`;
          } else {
            fetchUrl = `${API}/tenant/by-slug/${tenantIdParam}`;
          }
        } else {
          setLoading(false);
          return;
        }

        const res = await fetch(fetchUrl);
        const d = await res.json();

        if (d?.tenant?.id) {
          setTenantId(Number(d.tenant.id));
          if (d.tenant.name) setSchoolName(d.tenant.name);
          if (d.tenant.logo_url) setSchoolLogoUrl(d.tenant.logo_url);
          if (d.tenant.primary_color) setPrimaryColor(d.tenant.primary_color);
          if (d.tenant.secondary_color) setSecondaryColor(d.tenant.secondary_color);

          applyTenantPwaBranding(
            {
              id: d.tenant.id,
              name: d.tenant.name,
              slug: d.tenant.slug,
              logo_url: d.tenant.logo_url,
              primary_color: d.tenant.primary_color,
              secondary_color: d.tenant.secondary_color,
            },
            'parent',
          );
        }
      } catch (err) {
        console.error('Failed to resolve tenant for parent portal:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [tenantIdParam, slug, fetchAttempt]);

  if (loading) {
    return (
      <BrandedLoadingScreen
        logoUrl={schoolLogoUrl}
        label="Opening parent portal…"
        tone="dark"
        active={loading}
        onRetry={() => setFetchAttempt((n) => n + 1)}
      />
    );
  }

  if (!tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="max-w-md p-8 text-center bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Invalid Portal Link</h2>
          <p className="text-slate-400 text-sm">We couldn't find the school portal you're looking for. Please double-check the URL or contact the school administration.</p>
        </div>
      </div>
    );
  }

  return (
    <ParentPortal
      tenantId={tenantId}
      schoolName={schoolName}
      schoolLogoUrl={schoolLogoUrl}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
    />
  );
};

export default ParentPortal;

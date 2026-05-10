import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GraduationCap, LogOut, BookOpen, Trophy, CreditCard,
  CalendarCheck, Eye, EyeOff, Lock, ChevronRight, Medal,
  TrendingUp, CheckCircle2, XCircle, Clock, AlertTriangle,
  BadgeCheck, Home, RefreshCw, Activity, Bell, Download, X, MessageSquare, Send, Phone, Mail, Plus,
} from 'lucide-react';
import ReceiptPrinter from '@/components/common/ReceiptPrinter';
import { parseReceiptSnapshot, termsMatch } from '@/utils/feeCalculations';
import { io, Socket } from 'socket.io-client';
import { detectTenantSlugFromHost } from '@/utils/tenantHost';
import { getFcmToken, removeFcmToken } from '@/services/firebase';

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace('/api', '');

// ── API base ──────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const FIREBASE_WEB_PUSH_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
const MESSAGE_TYPE_LABEL: Record<'absence' | 'fee' | 'academic' | 'teacher' | 'late' | 'general', string> = {
  absence: 'Absence Notice',
  fee: 'Fee Query',
  academic: 'Academic Concern',
  teacher: 'Teacher Concern',
  late: 'Late Arrival',
  general: 'General Enquiry',
};

async function parentFetch(path: string, opts: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const slug = detectTenantSlugFromHost();
  if (slug) headers['X-Tenant-Slug'] = slug;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function parentFetchForm(path: string, formData: FormData, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const slug = detectTenantSlugFromHost();
  if (slug) headers['X-Tenant-Slug'] = slug;
  const res = await fetch(`${API}${path}`, { method: 'POST', body: formData, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
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

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

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
  at: number;
  read: boolean;
};

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

  // Login form
  const [loginAdmission, setLoginAdmission] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Password change form
  const [pwCurrent, setPwCurrent] = useState('');
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
  const parentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDeskMessage || deskConversation.length > 0) {
      setTimeout(() => parentScrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [selectedDeskMessage, deskConversation]);

  const [appNotifications, setAppNotifications] = useState<ParentAppNotification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<ParentAppNotification | null>(null);
  const [showDeskGuide, setShowDeskGuide] = useState(false);

  // Photo lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Multi-account switcher
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>(() => {
    const saved = localStorage.getItem(`parent_accounts_${tenantId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const persist = (t: string, s: StudentInfo) => {
    localStorage.setItem(`parent_token_${tenantId}`, t);
    localStorage.setItem(`parent_student_${tenantId}`, JSON.stringify(s));

    // Update linked accounts list
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

  const handleSwitchAccount = async (acc: LinkedAccount) => {
    // Clear current student data
    setGrades(null);
    setTermReport(null);
    setFinance(null);
    setAttendance(null);
    setDeskMessages([]);
    
    // Set new context
    setToken(acc.token);
    setStudent(acc.student);
    setMustChangePassword(acc.student.must_change_password);
    localStorage.setItem(`parent_token_${tenantId}`, acc.token);
    localStorage.setItem(`parent_student_${tenantId}`, JSON.stringify(acc.student));
    
    setShowSwitcher(false);
    setActiveTab('overview');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const data = await parentFetch('/parent/login', {
        method: 'POST',
        body: JSON.stringify({ tenantId, studentId: loginAdmission.trim(), password: loginPassword }),
      });
      
      // Fetch full student info for the NEW student
      const me = await parentFetch('/parent/me', {}, data.token);

      // IF we are adding an account, verify guardian name & phone matches the CURRENT student
      if (isAddingAccount && student) {
        const currentGuardian = (student.guardian_name || '').trim().toLowerCase();
        const newGuardian = (me.guardian_name || '').trim().toLowerCase();

        const normalizePhone = (p: string | null | undefined) => (p || '').replace(/\D/g, '');
        const currentPhone = normalizePhone(student.guardian_contact);
        const newPhone = normalizePhone(me.guardian_contact);

        if (!currentGuardian || !newGuardian || currentGuardian !== newGuardian) {
          throw new Error(`Guardian mismatch. This session is for ${student.guardian_name || 'N/A'}, but this child belongs to ${me.guardian_name || 'N/A'}.`);
        }

        if (!currentPhone || !newPhone || currentPhone !== newPhone) {
          throw new Error(`Guardian contact mismatch. Phone numbers must match to link siblings automatically.`);
        }

        // Call backend to link them as siblings officially in the database
        await parentFetch('/parent/link-siblings', {
          method: 'POST',
          body: JSON.stringify({ targetStudentId: me.id }),
        }, token!); 
      }

      setToken(data.token);
      setMustChangePassword(data.mustChangePassword);
      setStudent(me);
      persist(data.token, me);
      setIsAddingAccount(false);
      setLoginAdmission('');
      setLoginPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwNew !== pwConfirm) { setPwError('Passwords do not match'); return; }
    if (pwNew.length < 6) { setPwError('Password must be at least 6 characters'); return; }
    setPwLoading(true);
    try {
      await parentFetch('/parent/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      }, token!);
      setPwSuccess('Password changed successfully!');
      setMustChangePassword(false);
      if (student) {
        const updated = { ...student, must_change_password: false };
        setStudent(updated);
        localStorage.setItem(`parent_student_${tenantId}`, JSON.stringify(updated));
      }
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
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
      // Switch to the next available account
      handleSwitchAccount(updatedAccounts[0]);
    } else {
      // Complete logout
      localStorage.removeItem(`parent_token_${tenantId}`);
      localStorage.removeItem(`parent_student_${tenantId}`);
      setToken(null);
      setStudent(null);
      setGrades(null);
      setTermReport(null);
      setFinance(null);
      setAttendance(null);
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

  const loadServerNotifications = useCallback(async (authToken: string) => {
    const data = await parentFetch('/parent/notifications', {}, authToken).catch(() => ({ notifications: [] }));
    const mapped = Array.isArray(data?.notifications)
      ? data.notifications.map((n: any) => ({
          id: `srv-${n.id}`,
          serverId: Number(n.id),
          title: n.title,
          message: n.message,
          at: new Date(n.created_at).getTime(),
          read: Boolean(n.is_read),
        }))
      : [];
    setAppNotifications(mapped);
  }, []);

  const loadDeskMessages = useCallback(async () => {
    if (!token) return;
    setDeskLoading(true);
    try {
      const data = await parentFetch('/messages?page=1&limit=20', {}, token);
      setDeskMessages(Array.isArray(data?.messages) ? data.messages : []);
      setDeskContact(data?.contact || {});
    } catch {
      setDeskMessages([]);
    } finally {
      setDeskLoading(false);
    }
  }, [token]);

  const openDeskConversation = useCallback(async (id: number) => {
    if (!token) return;
    const data = await parentFetch(`/messages/${id}`, {}, token);
    setSelectedDeskMessage(data?.message || null);
    setDeskConversation(Array.isArray(data?.replies) ? data.replies : []);
    await parentFetch(`/messages/${id}/read`, { method: 'PUT', body: JSON.stringify({}) }, token).catch(() => undefined);
    setDeskMessages((prev) => prev.map((m) => (Number(m.id) === Number(id) ? { ...m, unread_replies: 0 } : m)));
  }, [token]);

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
  }, [token, deskType, deskBody, deskAttachment, loadDeskMessages]);

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
  }, [token, selectedDeskMessage, deskReply, deskReplyAttachment, openDeskConversation, loadDeskMessages]);

  const fetchTabData = useCallback(async (tab: Tab) => {
    if (!token) return;
    setDataLoading(true);
    try {
      if (tab === 'grades' && !grades) {
        const d = await parentFetch('/parent/grades', {}, token);
        setGrades(d);
      } else if (tab === 'position' && !termReport) {
        const d = await parentFetch('/parent/term-report', {}, token);
        setTermReport(d);
      } else if (tab === 'finance') {
        const d = await parentFetch('/parent/finance', {}, token);
        setFinance(d);
      } else if (tab === 'attendance' && !attendance) {
        const d = await parentFetch('/parent/attendance', {}, token);
        setAttendance(d);
      } else if (tab === 'desk') {
        await loadDeskMessages();
      }
    } catch (err: any) {
      console.error(`Error loading ${tab}:`, err);
    } finally {
      setDataLoading(false);
    }
  }, [token, grades, termReport, finance, attendance, loadDeskMessages]);

  useEffect(() => {
    if (!token || activeTab !== 'finance') return;
    const interval = window.setInterval(() => {
      parentFetch('/parent/finance', {}, token)
        .then(setFinance)
        .catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [token, activeTab]);

  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    ensurePushSubscription(token, tenantId).catch(() => undefined);
    loadServerNotifications(token).catch(() => undefined);

    // Keep backend subscription in sync on long-lived sessions/devices.
    const syncInterval = window.setInterval(() => {
      ensurePushSubscription(token, tenantId).catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(syncInterval);
  }, [token, tenantId, loadServerNotifications]);

  useEffect(() => {
    if (!token) return;
    const socketUrl = API.replace('/api', '');
    const socket: Socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });

    socket.on('tenant-data-changed', async (evt: any) => {
      if (evt?.tenantId && Number(evt.tenantId) !== Number(tenantId)) return;
      const entity = String(evt?.entity || '');
      if (entity === 'payment' || entity === 'finance-payment') {
        const d = await parentFetch('/parent/finance', {}, token).catch(() => null);
        if (d) setFinance(d);
        pushNotification('Fee Payment Received', 'A new payment receipt has been recorded for your ward.');
        await loadServerNotifications(token).catch(() => undefined);
      } else if (entity === 'term-report-release') {
        const d = await parentFetch('/parent/term-report', {}, token).catch(() => null);
        if (d) setTermReport(d);
        pushNotification('Results Released', 'New term results are now available in your portal.');
        await loadServerNotifications(token).catch(() => undefined);
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
        await loadServerNotifications(token).catch(() => undefined);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, tenantId, student, pushNotification, loadServerNotifications]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    fetchTabData(tab);
  };

  const refreshTab = async () => {
    if (!token) return;
    setDataLoading(true);
    try {
      if (activeTab === 'grades') { const d = await parentFetch('/parent/grades', {}, token); setGrades(d); }
      else if (activeTab === 'position') { const d = await parentFetch('/parent/term-report', {}, token); setTermReport(d); }
      else if (activeTab === 'finance') { const d = await parentFetch('/parent/finance', {}, token); setFinance(d); }
      else if (activeTab === 'attendance') { const d = await parentFetch('/parent/attendance', {}, token); setAttendance(d); }
      else if (activeTab === 'desk') { await loadDeskMessages(); }
    } catch { /* silent */ }
    finally { setDataLoading(false); }
  };

  const hardRefreshApp = useCallback(async () => {
    if (!token) return;
    try {
      setHardRefreshing(true);
      const [financeData, termData, gradesData, attendanceData, meData] = await Promise.all([
        parentFetch('/parent/finance', {}, token).catch(() => null),
        parentFetch('/parent/term-report', {}, token).catch(() => null),
        parentFetch('/parent/grades', {}, token).catch(() => null),
        parentFetch('/parent/attendance', {}, token).catch(() => null),
        parentFetch('/parent/me', {}, token).catch(() => null),
      ]);
      if (financeData) setFinance(financeData);
      if (termData) setTermReport(termData);
      if (gradesData) setGrades(gradesData);
      if (attendanceData) setAttendance(attendanceData);
      if (meData) setStudent(meData);
      await loadServerNotifications(token).catch(() => undefined);
    } finally {
      setHardRefreshing(false);
    }
  }, [token, loadServerNotifications]);

  useEffect(() => {
    if (!token) return;
    const autoHardRefresh = window.setInterval(() => {
      hardRefreshApp().catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(autoHardRefresh);
  }, [token, hardRefreshApp]);

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
        term: payment?.term || finance.currentTerm,
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

    const anchorTerm = String(payment?.term || finance.currentTerm || '').trim();
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
      term: payment?.term || finance.currentTerm,
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
  const premiumHeaderGradient = `linear-gradient(120deg, #0b1220 0%, ${brandPrimary} 52%, ${brandSecondary} 100%)`;
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
  if (!token || !student || isAddingAccount) {
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
                  <p className="text-purple-300 text-sm font-medium mt-0.5">ScholarNerve Parent Portal</p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/30">
                  <GraduationCap className="w-9 h-9 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">{schoolName || 'School'} — ScholarNerve Parent Portal</h1>
              </>
            )}
            <p className="text-slate-400 text-sm mt-3">
              {isAddingAccount ? 'Log in to add another child account' : "Use your child's Student ID to log in"}
            </p>
          </div>

          {/* Card */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 shadow-2xl relative">
            {isAddingAccount && (
              <button
                onClick={() => setIsAddingAccount(false)}
                className="absolute -top-12 right-0 text-white/60 hover:text-white flex items-center gap-1 text-sm transition-colors"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1.5">Student ID</label>
                <input
                  type="text"
                  value={loginAdmission}
                  onChange={e => setLoginAdmission(e.target.value)}
                  placeholder="e.g. 20260001"
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
                { label: 'Current Password (your Student ID)', val: pwCurrent, set: setPwCurrent, auto: 'current-password' },
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top nav ── */}
      <header className="shadow-lg sticky top-0 z-30 border-b border-white/10" style={{ background: premiumHeaderGradient }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* School logo */}
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
              {resolvedLogo
                ? <img src={resolvedLogo} alt="" className="w-full h-full object-contain p-0.5" />
                : <GraduationCap className="w-4 h-4 text-white" />}
            </div>
            {/* Student profile switcher trigger */}
            <button
              onClick={() => setShowSwitcher(true)}
              className="flex items-center gap-3 min-w-0 hover:bg-white/5 p-1 rounded-xl transition-colors text-left"
            >
              {/* Student photo thumbnail */}
              <div
                className={`w-8 h-8 rounded-full overflow-hidden shrink-0 border-2 border-purple-400/60 flex items-center justify-center text-xs font-bold text-white ${studentPhotoUrl ? 'bg-white' : 'bg-gradient-to-br from-purple-400 to-pink-400'}`}
              >
                {studentPhotoUrl
                  ? <img src={studentPhotoUrl} alt="" className="w-full h-full object-cover" />
                  : `${student.first_name[0]}${student.last_name[0]}`}
              </div>
              <div className="min-w-0 flex items-center gap-1.5">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-purple-300 text-[10px] truncate uppercase tracking-tight">
                    {student.class_name}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0 rotate-90" />
              </div>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallApp}
              className="relative flex items-center justify-center text-slate-300 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors border border-white/20"
              title="Install app"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowNotifPanel((v) => !v);
              }}
              className="relative flex items-center justify-center text-slate-300 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 font-bold">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            {student.must_change_password && (
              <button
                onClick={() => setMustChangePassword(true)}
                className="hidden sm:flex items-center gap-1 bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs px-2.5 py-1.5 rounded-lg hover:bg-amber-500/30 transition-colors"
              >
                <AlertTriangle className="w-3 h-3" /> Change password
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
        {showNotifPanel && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow p-3 max-h-60 overflow-y-auto">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-600">Notifications</p>
                {appNotifications.length > 0 && (
                  <button
                    onClick={async () => {
                      if (token) {
                        await parentFetch('/parent/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }, token).catch(() => undefined);
                      }
                      setAppNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                    }}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-700"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              {appNotifications.length === 0 ? (
                <p className="text-xs text-slate-400">No notifications yet.</p>
              ) : (
                <div className="space-y-2">
                  {appNotifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={async () => {
                        if (token && n.serverId && !n.read) {
                          await parentFetch(`/parent/notifications/${n.serverId}/read`, { method: 'POST', body: JSON.stringify({}) }, token).catch(() => undefined);
                        }
                        setAppNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item));
                        setSelectedNotification({ ...n, read: true });
                      }}
                      className={`w-full text-left rounded-lg border p-2 transition-colors ${n.read ? 'border-slate-100 bg-white hover:bg-slate-50' : 'border-purple-100 bg-purple-50/50 hover:bg-purple-100/60'}`}
                    >
                      <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(n.at).toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Desktop tab bar */}
        <div className="hidden sm:flex max-w-6xl mx-auto px-6 gap-0 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? 'border-purple-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-8">

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
          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                onClick={() => hardRefreshApp().catch(() => undefined)}
                disabled={hardRefreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-3.5 py-2 text-sm font-semibold text-purple-700 shadow-sm hover:bg-purple-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${hardRefreshing ? 'animate-spin' : ''}`} />
                {hardRefreshing ? 'Refreshing...' : 'Refresh App'}
              </button>
            </div>
            {/* Student card */}
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-5 text-white shadow-xl shadow-purple-200">
              <div className="flex items-start gap-4">
                {/* Passport photo — clickable */}
                <button
                  onClick={() => studentPhotoUrl && setLightboxUrl(studentPhotoUrl)}
                  className={`shrink-0 relative group ${studentPhotoUrl ? 'cursor-pointer' : 'cursor-default'}`}
                  title={studentPhotoUrl ? 'Click to view full photo' : undefined}
                >
                  <div className="w-20 h-24 rounded-xl overflow-hidden bg-white/20 border-2 border-white/30 flex items-center justify-center text-3xl font-bold shadow-lg">
                    {studentPhotoUrl
                      ? <img src={studentPhotoUrl} alt="" className="w-full h-full object-cover" />
                      : `${student.first_name[0]}${student.last_name[0]}`}
                  </div>
                  {studentPhotoUrl && (
                    <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold">{student.first_name} {student.last_name}</h2>
                  <p className="text-purple-200 text-sm">Student ID: {student.admission_number}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-white/20 text-xs px-2.5 py-1 rounded-full font-medium">{student.class_name || 'No class assigned'}</span>
                    {student.gender && <span className="bg-white/20 text-xs px-2.5 py-1 rounded-full font-medium capitalize">{student.gender}</span>}
                    {student.is_beneficiary && (
                      <span className="bg-amber-400 text-amber-900 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-sm border border-amber-300">
                        <Medal className="w-3 h-3" /> {student.beneficiary_type || 'Beneficiary'}
                      </span>
                    )}
                  </div>
                  {!studentPhotoUrl && (
                    <p className="text-purple-300 text-xs mt-2 italic">No photo uploaded yet</p>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-purple-200 text-xs">School</p>
                  <p className="font-semibold text-sm mt-0.5">{student.school_name}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-xs">Current Term</p>
                  <p className="font-semibold text-sm mt-0.5">{student.current_term}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-xs">Academic Year</p>
                  <p className="font-semibold text-sm mt-0.5">{student.current_year}</p>
                </div>
              </div>
            </div>

            {/* Quick-access cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {tabs.filter(t => t.key !== 'overview').map(t => (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100 transition-all group min-h-[115px]"
                >
                  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 opacity-90" />
                  <span className="w-10 h-10 bg-gradient-to-br from-purple-50 to-indigo-50 group-hover:from-purple-100 group-hover:to-indigo-100 rounded-xl flex items-center justify-center text-purple-600 transition-colors shadow-sm">
                    {t.icon}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">{t.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                </button>
              ))}
            </div>

            {/* Info note */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-2">
              <BadgeCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <p>This portal shows your child's academic performance, attendance and fee balance. Data is updated in real time by the school.</p>
            </div>
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

            {dataLoading && !grades ? (
              <LoadingCard />
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
                <Trophy className="w-5 h-5 text-yellow-500" /> Class Position
              </h2>
              <button onClick={refreshTab} disabled={dataLoading} className="text-gray-400 hover:text-purple-600 transition-colors">
                <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {dataLoading && !termReport ? (
              <LoadingCard />
            ) : !termReport?.report ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">{termReport?.message || 'No report data available.'}</p>
                <p className="text-xs text-gray-400 mt-1">Check back after your teacher releases the report.</p>
              </div>
            ) : (() => {
              const { report } = termReport;
              const myRecord = report.students.find((s: any) => s.isCurrentStudent);
              return (
                <div className="space-y-4">
                  {/* My position card */}
                  {myRecord && (
                    <div className={`rounded-2xl p-5 text-white shadow-lg ${
                      myRecord.position === 1 ? 'bg-gradient-to-br from-yellow-500 to-amber-600' :
                      myRecord.position === 2 ? 'bg-gradient-to-br from-slate-400 to-slate-600' :
                      myRecord.position === 3 ? 'bg-gradient-to-br from-amber-600 to-orange-700' :
                      'bg-gradient-to-br from-purple-600 to-indigo-700'
                    }`}>
                      {/* Report metadata */}
                      {report.schoolName && (
                        <p className="text-white/60 text-[10px] uppercase tracking-wider mb-3 font-medium">
                          {report.schoolName} · {report.currentTerm.includes(report.currentYear) ? report.currentTerm : `${report.currentTerm} ${report.currentYear}`}
                        </p>
                      )}
                      <div className="flex items-center gap-4">
                        {/* Passport photo */}
                        <div className="w-16 h-20 rounded-lg overflow-hidden bg-white/20 shrink-0 flex items-center justify-center text-white font-bold text-lg border-2 border-white/30">
                          {myRecord.passportPhotoUrl
                            ? <img src={resolveMediaUrl(myRecord.passportPhotoUrl) || ''} alt="" className="w-full h-full object-cover" />
                            : `${myRecord.firstName[0]}${myRecord.lastName[0]}`}
                        </div>
                        <div className="flex-1">
                          <p className="text-white/70 text-xs mb-0.5">Position in {report.className}</p>
                          <span className="text-5xl font-black leading-none">{positionLabel(myRecord.position)}</span>
                          <p className="text-white/80 text-sm mt-1.5">
                            Out of <strong>{report.totalStudents}</strong> students
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-white/70 text-xs">Total Score</p>
                          <p className="text-3xl font-bold mt-1">{Math.round(myRecord.grandTotal)}</p>
                          <p className="text-white/70 text-xs">out of {myRecord.grandMax}</p>
                          <p className="text-2xl font-bold mt-0.5">{myRecord.percentage}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subject breakdown */}
                  {myRecord && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-purple-600" /> Subject Performance
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {report.subjects.map((subj: string) => {
                          const s = myRecord.subjectScores[subj];
                          if (!s) return null;
                          const p = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
                          const lg = getLetterGrade(p);
                          return (
                            <div key={subj} className="px-4 py-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-sm font-medium text-gray-800">{subj}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-700">{Math.round(s.score)}/{s.maxScore}</span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${lg.color}`}>{lg.letter}</span>
                                  <span className="text-xs text-gray-500 w-8 text-right">{p}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full">
                                <div className={`h-full rounded-full ${p >= 70 ? 'bg-green-500' : p >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${p}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Class size info only — no names of other students */}
                  <div className="bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
                    <Medal className="w-4 h-4 text-yellow-500 shrink-0" />
                    <span>Class of <strong className="text-gray-700">{report.totalStudents}</strong> students · {report.className}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Finance tab ── */}
        {activeTab === 'finance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-600" /> Fee Balance
              </h2>
              <button onClick={refreshTab} disabled={dataLoading} className="text-gray-400 hover:text-purple-600 transition-colors">
                <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {dataLoading && !finance ? (
              <LoadingCard />
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
                        <p className="text-sm font-bold text-amber-900">{student.beneficiary_type || 'Scholarship/Beneficiary'}</p>
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
                <div className={`rounded-2xl p-5 text-white shadow-lg ${
                  finance.status === 'paid' ? 'bg-gradient-to-br from-green-500 to-emerald-700'
                  : finance.status === 'partial' ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                  : 'bg-gradient-to-br from-red-500 to-rose-700'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">
                        {finance.schoolName || student.school_name}
                      </p>
                      <p className="text-white/70 text-xs mb-1">
                        {finance.currentTerm.includes(finance.currentYear) ? finance.currentTerm : `${finance.currentTerm} ${finance.currentYear}`}
                      </p>
                      <p className="text-3xl font-black mt-1">{GH(Math.max(0, finance.balance))}</p>
                      <p className="text-white/80 text-sm mt-1">Outstanding Balance</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        finance.status === 'paid' ? 'bg-green-400/30 text-green-100'
                        : finance.status === 'partial' ? 'bg-amber-400/30 text-amber-100'
                        : 'bg-red-400/30 text-red-100'
                      }`}>
                        {finance.status === 'paid' ? '✓ Fully Paid' : finance.status === 'partial' ? 'Partially Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
                    <div className="text-center">
                      <p className="text-white/60 text-[10px] uppercase tracking-wide">Term Fee</p>
                      <p className="text-sm font-bold mt-0.5">{GH(finance.termFee)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/60 text-[10px] uppercase tracking-wide">Arrears</p>
                      <p className="text-sm font-bold mt-0.5">{GH(finance.arrears)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/60 text-[10px] uppercase tracking-wide">Paid</p>
                      <p className="text-sm font-bold mt-0.5">{GH(finance.totalPaid)}</p>
                    </div>
                  </div>
                </div>

                {/* Fee breakdown */}
                {finance.feeStructure && (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-800 text-sm">Fee Breakdown — {finance.currentTerm}</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {[
                        { label: 'Tuition Fee', val: finance.feeStructure.tuition_fee },
                        { label: 'PTA Fee', val: finance.feeStructure.pta_fee },
                        { label: 'Sports Fee', val: finance.feeStructure.sports_fee },
                        { label: 'Library Fee', val: finance.feeStructure.library_fee },
                        { label: 'Other', val: finance.feeStructure.other_fee },
                      ].filter(r => parseFloat(r.val || '0') > 0).map(r => (
                        <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm text-gray-600">{r.label}</span>
                          <span className="text-sm font-semibold text-gray-800">{GH(parseFloat(r.val))}</span>
                        </div>
                      ))}
                      {finance.discountAmount > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50">
                          <span className="text-sm text-amber-700 flex items-center gap-1.5">
                            <Medal className="w-3.5 h-3.5" /> Scholarship / Discount
                          </span>
                          <span className="text-sm font-bold text-amber-700">-{GH(finance.discountAmount)}</span>
                        </div>
                      )}
                      {finance.arrears > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-red-50">
                          <span className="text-sm text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Arrears from previous term
                          </span>
                          <span className="text-sm font-semibold text-red-700">{GH(finance.arrears)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                        <span className="text-sm font-bold text-gray-800">Total Due</span>
                        <span className="text-sm font-bold text-gray-800">{GH(finance.totalDue)}</span>
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
                      {finance.payments.map((p: any) => (
                        <div key={p.id ?? `${p.receipt_number}-${p.payment_date}`} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            p.term === finance.currentTerm ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{GH(parseFloat(p.amount_paid))}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1 flex-wrap">
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
                              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                                {p.reference_number ? `Ref: ${p.reference_number}` : ''}
                                {p.reference_number && p.notes ? ' · ' : ''}
                                {p.notes ? `Note: ${p.notes}` : ''}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openReceipt(p)}
                            className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
                          >
                            View Receipt
                          </button>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            p.term === finance.currentTerm
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {p.term || '—'}
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

            {dataLoading && !attendance ? (
              <LoadingCard />
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

            {deskLoading ? (
              <LoadingCard />
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
                      <span className="text-[11px] text-slate-400 shrink-0">{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">{m.message}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[11px] px-2 py-1 rounded-full ${
                        m.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
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
      <footer className="border-t border-gray-200 mt-10 py-4 text-center text-xs text-gray-400">
        {student.school_name} · ScholarNerve Parent Portal · Secure & Private
      </footer>

      {/* Mobile bottom navigation */}
      <nav className="sm:hidden fixed bottom-3 left-3 right-3 z-40 border border-violet-200/70 bg-white/95 backdrop-blur px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] rounded-2xl shadow-xl">
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, ${brandPrimary}, ${brandSecondary})` }}
        />
        <div className="grid grid-cols-6 gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors ${
                activeTab === t.key
                  ? 'text-white shadow-lg'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              style={activeTab === t.key ? { background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})` } : undefined}
            >
              {t.icon}
              <span className="leading-none">{t.label}</span>
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
            <textarea
              value={deskBody}
              onChange={(e) => setDeskBody(e.target.value)}
              rows={5}
              placeholder="Write your message..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            <div className="mt-2 text-right text-xs text-slate-400">{deskBody.length} characters</div>
            <input type="file" accept="image/*" onChange={(e) => setDeskAttachment(e.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-slate-500" />
            <button
              onClick={() => submitDeskMessage().catch(() => undefined)}
              className="mt-3 w-full rounded-xl text-white font-semibold py-2.5 flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(90deg, ${brandPrimary}, ${brandSecondary})` }}
            >
              <Send className="w-4 h-4" /> Send Message
            </button>
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
                        src={selectedDeskMessage.attachment_url} 
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
                  <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    r.sender_type === 'parent'
                      ? 'bg-[#dcf8c6] border border-green-200 text-slate-700 rounded-br-md'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
                  }`}>
                    <p>{r.reply_text}</p>
                    {r.attachment_url && (
                      <div className={`mt-2 rounded-lg overflow-hidden border ${r.sender_type === 'parent' ? 'border-green-300' : 'border-slate-200'}`}>
                        <img 
                          src={r.attachment_url} 
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
            <div className="p-3 border-t border-slate-100">
              <textarea value={deskReply} onChange={(e) => setDeskReply(e.target.value)} rows={2} placeholder="Type your follow-up reply..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-200" />
              <div className="mt-2 flex items-center gap-2">
                <input type="file" accept="image/*" onChange={(e) => setDeskReplyAttachment(e.target.files?.[0] || null)} className="block text-xs text-slate-500 flex-1" />
                <button onClick={() => submitDeskReply().catch(() => undefined)} className="rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: brandPrimary }}>
                  Send
                </button>
              </div>
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
              <div className="mt-4 flex justify-end">
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
              <div className="space-y-1">
                {linkedAccounts.map((acc) => {
                  const isActive = acc.student.admission_number === student.admission_number;
                  return (
                    <button
                      key={acc.student.admission_number}
                      onClick={() => handleSwitchAccount(acc)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 ${
                        isActive 
                          ? 'bg-purple-50/50 border border-purple-100' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`relative w-14 h-14 rounded-2xl overflow-hidden shadow-sm border-2 transition-all duration-300 ${
                          isActive ? 'border-purple-500 scale-105' : 'border-white'
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
                onClick={() => {
                  setShowSwitcher(false);
                  setIsAddingAccount(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-[0.98] shadow-sm"
              >
                <div className="w-6 h-6 rounded-full border-2 border-slate-200 flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                Add Sibling Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Shared sub-components ─────────────────────────────────────────────────────

const LoadingCard = () => (
  <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
    <RefreshCw className="w-8 h-8 text-purple-300 animate-spin mx-auto mb-3" />
    <p className="text-sm text-gray-400">Loading…</p>
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

  React.useEffect(() => {
    const fetchTenant = async () => {
      setLoading(true);
      try {
        let fetchUrl = '';
        if (slug) {
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
        }
      } catch (err) {
        console.error('Failed to resolve tenant for parent portal:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [tenantIdParam, slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 gap-4">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-purple-300/60 font-medium animate-pulse uppercase tracking-widest text-xs">Resolving Portal...</p>
      </div>
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

import { GraduationCap, Headphones, Lock, Moon, Smartphone, Sun, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { PartnerPage, PortalCard } from './partnerShared';
import { usePartnerSession } from '@/pages/partners/partnerSession';
import { openPartnerInstallGuide, usePartnerInstallAvailable } from './PartnerInstallGuide';

export default function PartnerMore() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { stats } = usePartnerSession();
  const supportUnread = stats.unreadSupportMessages ?? 0;
  const showInstallGuide = usePartnerInstallAvailable();

  const items = [
    {
      icon: GraduationCap,
      title: 'Training Videos',
      desc: 'Watch practical lessons to win more schools',
      action: () => navigate('/training'),
      color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    },
    {
      icon: Headphones,
      title: 'Support',
      desc: 'Message ScholarNerve — get help with payouts, referrals & more',
      action: () => navigate('/support'),
      color: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
      badge: supportUnread,
    },
    {
      icon: User,
      title: 'My Profile & ID Card',
      desc: 'Photo, partner ID, payout details',
      action: () => navigate('/profile'),
      color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300',
    },
    {
      icon: Lock,
      title: 'Change Password',
      desc: 'Update your login password',
      action: () => navigate('/profile?section=password'),
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
    },
  ];

  return (
    <PartnerPage>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">More</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Training, support, settings, and account</p>
      </div>

      <div className="space-y-3">
        {items.map(({ icon: Icon, title, desc, action, color, badge }) => (
          <button
            key={title}
            type="button"
            onClick={action}
            className="snp-glass-card relative flex w-full items-center gap-4 rounded-2xl border border-white/80 bg-white/95 p-4 text-left shadow-sm transition hover:-translate-y-0.5 dark:border-slate-700/80 dark:bg-slate-900/90"
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 dark:text-white">{title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
            {badge && badge > 0 ? (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white">
                {badge > 9 ? '9+' : badge}
              </span>
            ) : null}
          </button>
        ))}

        {showInstallGuide ? (
          <button
            type="button"
            onClick={() => openPartnerInstallGuide()}
            className="snp-glass-card relative flex w-full items-center gap-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/95 to-teal-50/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-teal-950/30"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 dark:text-white">Install on your phone</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Step-by-step guide to add the app to your home screen</p>
            </div>
          </button>
        ) : null}

        <PortalCard className="p-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-slate-600" />}
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900 dark:text-white">Appearance</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{theme === 'dark' ? 'Dark mode on' : 'Light mode on'}</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Tap to switch
            </span>
          </button>
        </PortalCard>
      </div>
    </PartnerPage>
  );
}

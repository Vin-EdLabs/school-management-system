import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import {
  fetchUnreadAnnouncements,
  markAnnouncementRead,
  TYPE_BORDER_COLORS,
  TYPE_ICONS,
  TYPE_LABELS,
  type AnnouncementType,
  type UnreadAnnouncement,
} from '../../services/globalAnnouncementsApi';
import './GlobalAnnouncementPopup.css';

function highlightSchoolName(text: string, schoolName: string): React.ReactNode {
  if (!schoolName || !text.includes(schoolName)) return text;
  const parts = text.split(schoolName);
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <span className="school-name-highlight">{schoolName}</span> : null}
    </React.Fragment>
  ));
}

const GlobalAnnouncementPopup: React.FC = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [queue, setQueue] = useState<UnreadAnnouncement[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [checked, setChecked] = useState(false);

  const shouldCheck =
    isAuthenticated &&
    !authLoading &&
    user &&
    (user.role === 'administrator' || user.role === 'finance');

  const loadUnread = useCallback(async () => {
    if (!shouldCheck) return;
    setLoading(true);
    try {
      const res = await fetchUnreadAnnouncements();
      setQueue(res.items || []);
      setSchoolName(res.schoolName || '');
      setIndex(0);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
      setChecked(true);
    }
  }, [shouldCheck]);

  const { socket } = useSocket();

  useEffect(() => {
    if (shouldCheck && !checked) void loadUnread();
  }, [shouldCheck, checked, loadUnread]);

  useEffect(() => {
    if (!socket || !shouldCheck) return;

    const handleNewAnnouncement = () => {
      void loadUnread();
    };

    socket.on('global-announcement-created', handleNewAnnouncement);
    return () => {
      socket.off('global-announcement-created', handleNewAnnouncement);
    };
  }, [socket, shouldCheck, loadUnread]);

  useEffect(() => {
    const blockEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockEscape, true);
    return () => window.removeEventListener('keydown', blockEscape, true);
  }, []);

  const current = queue[index] ?? null;
  const hasMore = index < queue.length - 1;
  const remaining = queue.length - index - 1;
  const announcementType = (current?.type as AnnouncementType) || 'info';
  const borderColor = TYPE_BORDER_COLORS[announcementType] || TYPE_BORDER_COLORS.info;
  const typeLabel = TYPE_LABELS[announcementType] || TYPE_LABELS.info;
  const typeIcon = TYPE_ICONS[announcementType] || TYPE_ICONS.info;
  const isUrgent = announcementType === 'urgent';

  const sentLabel = current?.created_at
    ? new Date(current.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const handleMarkRead = async () => {
    if (!current || marking) return;
    setMarking(true);
    try {
      await markAnnouncementRead(current.id);
      if (hasMore) {
        setIndex((i) => i + 1);
      } else {
        setQueue([]);
      }
    } catch {
      /* keep popup open */
    } finally {
      setMarking(false);
    }
  };

  if (!shouldCheck || loading || !current) return null;

  const buttonLabel = marking
    ? 'Please wait…'
    : hasMore
      ? `Mark as Read & Continue (${remaining} remaining)`
      : 'Mark as Read';

  return (
    <div
      className="global-announcement-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ga-title"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="global-announcement-card"
        style={{ borderTopColor: borderColor }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="global-announcement-card__top">
          <img
            src="/android-chrome-192x192.png"
            alt="ScholarNerve"
            className="global-announcement-card__logo"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="global-announcement-card__logo-divider" />
        </div>

        <div className="global-announcement-card__type-row">
          <span className="global-announcement-card__type-icon" aria-hidden>
            {typeIcon}
          </span>
          <span className="global-announcement-card__type-label" style={{ color: borderColor }}>
            {typeLabel}
          </span>
        </div>

        <h2 id="ga-title" className="global-announcement-card__title">
          {current.title}
        </h2>

        {queue.length > 1 ? (
          <span className="global-announcement-card__counter">
            {index + 1} of {queue.length}
          </span>
        ) : null}

        <div className="global-announcement-card__body">
          {highlightSchoolName(current.displayBody, schoolName)}
        </div>

        <div className="global-announcement-card__footer-divider" />

        <div className="global-announcement-card__meta">📅 Sent {sentLabel}</div>

        <div className="global-announcement-card__footer">
          <button
            type="button"
            className={`global-announcement-card__btn${isUrgent ? ' global-announcement-card__btn--urgent' : ''}`}
            onClick={() => void handleMarkRead()}
            disabled={marking}
          >
            {marking ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {buttonLabel}
              </span>
            ) : (
              buttonLabel
            )}
          </button>
        </div>

        <div className="global-announcement-card__watermark">Powered by ScholarNerve</div>
      </div>
    </div>
  );
};

export default GlobalAnnouncementPopup;

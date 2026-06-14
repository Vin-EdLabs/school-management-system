import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveLogoUrl } from '@/services/tenantService';
import { apiService } from '@/services/api';
import { cn } from '@/lib/utils';

type LazyTeacherAvatarProps = {
  teacherId: string;
  fullName?: string;
  hasPassportPhoto?: boolean;
  photoUrl?: string;
  className?: string;
  eager?: boolean;
};

const LazyTeacherAvatar: React.FC<LazyTeacherAvatarProps> = ({
  teacherId,
  fullName = '',
  hasPassportPhoto,
  photoUrl,
  className,
  eager = false,
}) => {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(eager);
  const [loadedUrl, setLoadedUrl] = useState<string | undefined>(
    photoUrl?.startsWith('data:') || photoUrl?.startsWith('http') ? photoUrl : undefined
  );

  useEffect(() => {
    if (eager) {
      setVisible(true);
      return;
    }
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, teacherId]);

  useEffect(() => {
    if (!visible || loadedUrl) return;
    if (!hasPassportPhoto && !photoUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiService.get<{ passport_photo_url?: string }>(`/teachers/${teacherId}/photo`);
        if (!cancelled && res.passport_photo_url) setLoadedUrl(res.passport_photo_url);
      } catch {
        /* fallback initials */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, loadedUrl, hasPassportPhoto, photoUrl, teacherId]);

  const parts = fullName.trim().split(/\s+/);
  const initials = `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase() || 'T';
  const resolvedSrc = loadedUrl ? resolveLogoUrl(loadedUrl) || undefined : undefined;

  return (
    <span ref={rootRef} className="inline-flex">
      <Avatar className={cn('h-9 w-9 rounded-full border border-border/80', className)}>
        {resolvedSrc ? <AvatarImage src={resolvedSrc} alt="" className="object-cover" /> : null}
        <AvatarFallback className="rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
          {initials}
        </AvatarFallback>
      </Avatar>
    </span>
  );
};

export default LazyTeacherAvatar;

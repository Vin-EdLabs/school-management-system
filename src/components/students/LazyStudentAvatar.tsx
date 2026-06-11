import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveLogoUrl } from '@/services/tenantService';
import { useSchool } from '@/contexts/SchoolContext';
import {
  fetchStudentPhoto,
  retryStudentPhotoUpload,
  studentsQueryKeys,
  useStudentPhotoUploadStatus,
} from '@/hooks/useStudentCache';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

type LazyStudentAvatarProps = {
  studentId: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  hasPassportPhoto?: boolean;
  className?: string;
  fallbackClassName?: string;
  /** Load immediately without waiting for intersection (e.g. open dialogs). */
  eager?: boolean;
};

const LazyStudentAvatar: React.FC<LazyStudentAvatarProps> = ({
  studentId,
  firstName = '',
  lastName = '',
  photoUrl,
  hasPassportPhoto,
  className,
  fallbackClassName,
  eager = false,
}) => {
  const rootRef = useRef<HTMLSpanElement>(null);
  const queryClient = useQueryClient();
  const { schoolId } = useSchool();
  const uploadStatus = useStudentPhotoUploadStatus(studentId);
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
  }, [eager, studentId]);

  useEffect(() => {
    if (photoUrl?.startsWith('data:') || photoUrl?.startsWith('blob:')) {
      setLoadedUrl(photoUrl);
      return;
    }
    if (photoUrl && resolveLogoUrl(photoUrl)) {
      setLoadedUrl(photoUrl);
    }
  }, [photoUrl]);

  useEffect(() => {
    if (!visible || loadedUrl) return;
    if (!hasPassportPhoto && !photoUrl) return;

    let cancelled = false;
    void (async () => {
      const cached = queryClient.getQueryData<{ passport_photo_url?: string }>(
        studentsQueryKeys.photo(schoolId, studentId)
      );
      if (cached?.passport_photo_url) {
        if (!cancelled) setLoadedUrl(cached.passport_photo_url);
        return;
      }
      try {
        const url = await fetchStudentPhoto(queryClient, schoolId, studentId);
        if (!cancelled && url) setLoadedUrl(url);
      } catch {
        // Keep fallback initials when photo fetch fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, loadedUrl, hasPassportPhoto, photoUrl, queryClient, schoolId, studentId]);

  const resolvedSrc = loadedUrl ? resolveLogoUrl(loadedUrl) || undefined : undefined;
  const showRetry = uploadStatus === 'failed';

  return (
    <span ref={rootRef} className="relative inline-flex">
      <Avatar className={cn('h-9 w-9 rounded-lg border border-border/80 shadow-sm', className)}>
        {resolvedSrc ? (
          <AvatarImage src={resolvedSrc} alt="" className="object-cover" loading="lazy" />
        ) : null}
        <AvatarFallback className={cn('rounded-lg text-xs font-semibold', fallbackClassName)}>
          {firstName?.[0]}
          {lastName?.[0]}
        </AvatarFallback>
      </Avatar>
      {showRetry && (
        <button
          type="button"
          title="Photo upload failed — tap to retry"
          onClick={(e) => {
            e.stopPropagation();
            retryStudentPhotoUpload(queryClient, schoolId, studentId);
          }}
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm hover:bg-amber-600"
        >
          <RefreshCw className="h-2.5 w-2.5" />
        </button>
      )}
      {uploadStatus === 'uploading' && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
      )}
    </span>
  );
};

export default LazyStudentAvatar;

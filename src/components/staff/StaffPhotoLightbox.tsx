import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ZoomIn } from 'lucide-react';

type Props = {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  rounded?: 'full' | 'lg';
};

const sizeMap = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
};

const StaffPhotoLightbox: React.FC<Props> = ({
  src,
  name,
  size = 'md',
  className,
  rounded = 'full',
}) => {
  const [open, setOpen] = useState(false);
  const hasPhoto = !!src;
  const radius = rounded === 'full' ? 'rounded-full' : 'rounded-xl';

  return (
    <>
      <button
        type="button"
        className={cn(
          'relative shrink-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          sizeMap[size],
          className
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (hasPhoto) setOpen(true);
        }}
        title={hasPhoto ? 'View photo' : name}
        disabled={!hasPhoto}
      >
        <Avatar className={cn(sizeMap[size], radius, hasPhoto && 'cursor-zoom-in ring-2 ring-border group-hover:ring-primary/40 transition-shadow')}>
          {src ? <AvatarImage src={src} alt={name} className="object-cover" /> : null}
          <AvatarFallback className={cn('text-sm font-medium', radius)}>
            {name?.slice(0, 2).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        {hasPhoto && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/25 transition-colors pointer-events-none">
            <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-2 sm:p-4 bg-black/95 border-none">
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={src!}
              alt={name}
              className="max-h-[min(80vh,640px)] w-auto max-w-full object-contain rounded-lg"
            />
            <p className="text-sm text-white/90 font-medium">{name}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StaffPhotoLightbox;

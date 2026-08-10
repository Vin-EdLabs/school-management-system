import React, { useEffect } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { redirectBoardingPathToDashboard } from '@/utils/boardingModule';

interface BoardingGuardProps {
  onNavigate?: (module: string) => void;
  children: React.ReactNode;
}

/**
 * Renders boarding content only when the module is enabled for the school.
 * When disabled, immediately redirects to dashboard (no boarding UI flash).
 */
export const BoardingGuard: React.FC<BoardingGuardProps> = ({ onNavigate, children }) => {
  const { school } = useSchool();
  const boardingReady = school !== null;
  const boardingEnabled = Boolean(school?.boarding_enabled);

  useEffect(() => {
    if (!boardingReady || boardingEnabled) return;

    if (onNavigate) {
      onNavigate('dashboard');
    }

    const nextPath = redirectBoardingPathToDashboard(window.location.pathname);
    if (nextPath !== window.location.pathname) {
      window.history.replaceState({}, '', nextPath);
    }
  }, [boardingReady, boardingEnabled, onNavigate]);

  if (!boardingReady) {
    return null;
  }

  if (!boardingEnabled) {
    return null;
  }

  return <>{children}</>;
};

export default BoardingGuard;

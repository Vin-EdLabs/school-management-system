import React, { useCallback, useEffect, useState } from 'react';
import ImpersonationTransitionOverlay from './ImpersonationTransitionOverlay';
import {
  clearImpersonationTransition,
  IMPERSONATION_TRANSITION_CHANGED_EVENT,
  isParentImpersonationTransitionReady,
  isStaffImpersonationTransitionReady,
  readImpersonationTransition,
  type ImpersonationTransitionState,
} from '../../utils/impersonationHelpers';

/** Keeps the premium transition overlay visible across route changes / reloads */
const ImpersonationTransitionGate: React.FC = () => {
  const [transition, setTransition] = useState<ImpersonationTransitionState | null>(() =>
    readImpersonationTransition()
  );

  const syncTransition = useCallback(() => {
    setTransition(readImpersonationTransition());
  }, []);

  useEffect(() => {
    const tryClear = () => {
      const active = readImpersonationTransition();
      if (!active) {
        setTransition(null);
        return;
      }

      const msg = active.message.toLowerCase();
      const portalMatch = window.location.pathname.match(/\/portal\/(\d+)/);

      let ready = false;
      if (msg.includes('parent portal') || msg.includes('opening parent')) {
        ready = portalMatch
          ? isParentImpersonationTransitionReady(parseInt(portalMatch[1], 10))
          : Date.now() - active.startedAt >= active.durationMs;
      } else if (msg.includes('switching') || msg.includes('returning')) {
        ready = isStaffImpersonationTransitionReady();
      } else {
        ready = Date.now() - active.startedAt >= active.durationMs;
      }

      if (ready) {
        clearImpersonationTransition();
        setTransition(null);
        return;
      }

      setTransition(active);
    };

    tryClear();
    const interval = window.setInterval(tryClear, 100);
    window.addEventListener(IMPERSONATION_TRANSITION_CHANGED_EVENT, syncTransition);
    window.addEventListener('storage', syncTransition);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(IMPERSONATION_TRANSITION_CHANGED_EVENT, syncTransition);
      window.removeEventListener('storage', syncTransition);
    };
  }, [syncTransition]);

  if (!transition) return null;
  return <ImpersonationTransitionOverlay message={transition.message} phase={transition.phase} />;
};

export default ImpersonationTransitionGate;

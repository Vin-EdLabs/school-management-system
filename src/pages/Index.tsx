
import React from 'react';
import LoginPage from '../components/LoginPage';
import Dashboard from '../components/Dashboard';
import AuditLoginTracker from '../components/AuditLoginTracker';
import GlobalChatTrigger from '../components/chat/GlobalChatTrigger';
import GlobalChatOverlay from '../components/chat/GlobalChatOverlay';
import { useAuth } from '../contexts/AuthContext';

const Index = () => {
  const { isAuthenticated } = useAuth();
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [onboardingStep, setOnboardingStep] = React.useState<number>(0);

  React.useEffect(() => {
    if (isAuthenticated) {
      const hasSeen = localStorage.getItem('hasSeenGlobalChatIntro');
      if (!hasSeen) {
        setOnboardingStep(1); // Start with step 1 (Trigger)
      }
    }
  }, [isAuthenticated]);

  const handleNextOnboarding = () => {
    if (onboardingStep === 1) {
       setIsChatOpen(true);
       setOnboardingStep(2);
    } else if (onboardingStep === 2) {
       setOnboardingStep(3);
    } else {
       localStorage.setItem('hasSeenGlobalChatIntro', 'true');
       setOnboardingStep(0);
    }
  };

  return (
    <>
      <AuditLoginTracker />
      {isAuthenticated ? (
        <>
          <Dashboard />
          <GlobalChatTrigger 
            onClick={() => setIsChatOpen(true)} 
            isOpen={isChatOpen} 
            showOnboarding={onboardingStep === 1}
            onNextOnboarding={handleNextOnboarding}
          />
          <GlobalChatOverlay 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)} 
            onboardingStep={onboardingStep}
            onNextOnboarding={handleNextOnboarding}
          />
        </>
      ) : (
        <LoginPage />
      )}
    </>
  );
};

export default Index;

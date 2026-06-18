import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { MapPinOff } from 'lucide-react';
import { PublicErrorPage } from '@/components/common/PublicErrorPage';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn('404 — route not found:', location.pathname);
    }
  }, [location.pathname]);

  return (
    <PublicErrorPage
      eyebrow="Error 404"
      title="Page not found"
      description="The page you are looking for does not exist or may have been moved. Return to the ScholarNerve home page or contact us for help."
      detail={location.pathname !== '/' ? location.pathname : undefined}
      icon={<MapPinOff className="h-5 w-5 text-emerald-700" aria-hidden />}
    />
  );
};

export default NotFound;

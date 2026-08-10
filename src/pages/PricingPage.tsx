import { Navigate } from 'react-router-dom';

/** Legacy import path — pricing lives at /pricing */
export default function PricingPageRedirect() {
  return <Navigate to="/pricing" replace />;
}

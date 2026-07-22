import { Navigate } from 'react-router-dom';

/** Legacy route — pricing lives on the home page at /#pricing */
export default function PricingPage() {
  return <Navigate to={{ pathname: '/', hash: 'pricing' }} replace />;
}

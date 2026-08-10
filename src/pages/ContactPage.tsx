import { Navigate } from 'react-router-dom';

/** Legacy import path — contact lives at /contact */
export default function ContactPageRedirect() {
  return <Navigate to="/contact" replace />;
}

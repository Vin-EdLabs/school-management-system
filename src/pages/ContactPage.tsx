import { Navigate } from 'react-router-dom';

/** Legacy route — contact lives on the home page at /#contact */
export default function ContactPage() {
  return <Navigate to={{ pathname: '/', hash: 'contact' }} replace />;
}

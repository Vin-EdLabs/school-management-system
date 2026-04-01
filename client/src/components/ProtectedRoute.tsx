import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type Props = {
    children: React.ReactElement;
    moduleKey?: string;
};

const ProtectedRoute: React.FC<Props> = ({ children, moduleKey }) => {
    const { isAuthenticated, hasAccess } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (moduleKey) {
        const allowed = hasAccess(moduleKey) || hasAccess(moduleKey + '-view-only');
        if (!allowed) {
            return <Navigate to="/" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;

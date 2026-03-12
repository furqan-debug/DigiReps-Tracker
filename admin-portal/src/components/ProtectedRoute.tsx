import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    roles?: string[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
    const { profile, loading, session, signOut, error } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            </div>
        );
    }

    if (!session) {
        // Redirect to login but save the current location
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. Strictly block 'User' role from Admin Portal
    // If we have a profile and the role is 'User', they don't belong here.
    if (profile?.role === 'User') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center border border-slate-100">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">🚫</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Admin Portal Access Restricted</h1>
                    <p className="text-slate-500 text-sm mb-8">
                        This portal is for Admins and Managers only. Please use the DigiReps Electron app for tracking.
                    </p>
                    <button 
                        onClick={() => signOut()}
                        className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    // 4. Handle cases where profile is missing/null (Identity failure)
    if (!profile && !loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center border border-slate-100">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Profile Not Found</h1>
                    <p className="text-slate-500 text-sm mb-4">
                        We couldn't find a management profile for your account. Please ensure your administrator has added you as an Admin or Viewer.
                    </p>
                    {error && (
                        <div className="mb-8 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-[10px] font-mono text-slate-400 uppercase mb-1 tracking-wider text-left">Internal Error</p>
                            <p className="text-xs text-rose-600 font-medium text-left break-all">{error}</p>
                        </div>
                    )}
                    <button 
                        onClick={() => signOut()}
                        className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    if (roles && profile && !roles.includes(profile.role)) {
        // Specific route role restriction
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center border border-slate-100">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">🚫</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
                    <p className="text-slate-500 text-sm mb-8">
                        You do not have permission to view this specific page.
                    </p>
                    <button 
                        onClick={() => window.history.back()}
                        className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { Star, LogOut, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useFavorites } from '../context/FavoritesContext';
import { getLabelForPath } from '../nav/navModel';
import { useAuth } from '../context/AuthContext';

export interface HeaderProps {
    /** Called when user taps the mobile menu button (opens sidebar overlay). */
    onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps = {}) {
    const location = useLocation();
    const navigate = useNavigate();
    const { toggleFavorite, isFavorite } = useFavorites();
    const { profile, user } = useAuth();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const logoutButtonRef = useRef<HTMLButtonElement>(null);

    const closeMenu = useCallback(() => setShowProfileMenu(false), []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                closeMenu();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [closeMenu]);

    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') closeMenu();
        }
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [closeMenu]);

    useEffect(() => {
        if (showProfileMenu) {
            logoutButtonRef.current?.focus();
        }
    }, [showProfileMenu]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const pageName = getLabelForPath(location.pathname);
    const favorited = isFavorite(location.pathname);

    return (
        <header className="h-14 glass border-b border-border/50 flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-10 w-full shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
                {onOpenMobileMenu && (
                    <button
                        type="button"
                        onClick={onOpenMobileMenu}
                        className="md:hidden p-2 -ml-2 rounded-shell-md text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" aria-hidden />
                    </button>
                )}
                <h1 className="text-base font-bold text-text-primary truncate font-head">
                    {pageName}
                </h1>
                <button
                    type="button"
                    onClick={() => toggleFavorite(pageName, location.pathname)}
                    className="p-2 rounded-shell-md hover:bg-surface-subtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface shrink-0"
                    aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <Star
                        className={`w-4 h-4 transition-transform ${favorited
                            ? 'fill-primary text-primary'
                            : 'text-text-muted hover:text-text-secondary'
                            }`}
                        aria-hidden
                    />
                </button>
            </div>

            <div className="flex items-center gap-2 text-text-secondary" ref={menuRef}>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowProfileMenu((v) => !v)}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center text-white text-xs font-bold shadow-md focus:outline-none"
                        aria-label="Profile options"
                        aria-expanded={showProfileMenu}
                        aria-haspopup="true"
                    >
                        {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
                    </button>

                    {showProfileMenu && (
                        <div
                            role="menu"
                            className="absolute right-0 top-full mt-2 w-52 glass border border-border rounded-lg shadow-xl py-1 z-50 overflow-hidden"
                            aria-orientation="vertical"
                        >
                            <div className="px-4 py-3 border-b border-border bg-white/5">
                                <p className="text-xs font-bold text-text-primary truncate">{profile?.full_name || 'No Name'}</p>
                                <p className="text-[10px] text-text-secondary truncate mt-0.5">{profile?.email || user?.email}</p>
                                <div className="mt-2 inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/10">
                                    {profile?.role || 'User'}
                                </div>
                            </div>
                            <button
                                ref={logoutButtonRef}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    closeMenu();
                                    void handleLogout();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors focus:outline-none"
                            >
                                <LogOut className="w-4 h-4 shrink-0" aria-hidden />
                                Log out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

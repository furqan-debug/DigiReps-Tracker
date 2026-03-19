import { useState, useRef, useEffect, useCallback } from 'react';
import { Star, LogOut, Menu, ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
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
        <header className="h-20 glass border-b border-black/[0.05] flex items-center justify-between px-6 md:px-10 shrink-0 sticky top-0 z-30 w-full shadow-lg shadow-[#293d63]/5 backdrop-blur-3xl">
            <div className="flex items-center gap-6 min-w-0">
                {onOpenMobileMenu && (
                    <button
                        type="button"
                        onClick={onOpenMobileMenu}
                        className="md:hidden p-2.5 -ml-2 rounded-2xl text-text-secondary hover:text-text-primary hover:bg-black/[0.03] transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                        aria-label="Open menu"
                    >
                        <Menu className="w-5.5 h-5.5" strokeWidth={2.5} />
                    </button>
                )}
                
                <div className="flex flex-col">
                    <h1 className="text-xl font-black text-text-primary truncate font-head leading-none mb-1.5 tracking-tighter">
                        {pageName}
                    </h1>
                     <div className="flex items-center gap-2 opacity-80">
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] font-mono">Matrix Node</span>
                        <ChevronRight className="w-3 h-3 text-text-muted" strokeWidth={3} />
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] truncate">{pageName || 'System Root'}</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => toggleFavorite(pageName, location.pathname)}
                    className="p-2.5 ml-2 rounded-2xl hover:bg-black/[0.03] transition-all group shrink-0"
                    aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <Star
                        className={`w-4.5 h-4.5 transition-all duration-300 ${favorited
                            ? 'fill-primary text-primary scale-110 drop-shadow-[0_0_8px_rgba(80,110,248,0.4)]'
                            : 'text-text-muted group-hover:text-amber-400 group-hover:scale-110'
                            }`}
                        strokeWidth={2.5}
                    />
                </button>
            </div>

            <div className="flex items-center gap-6 text-text-secondary" ref={menuRef}>
                <div className="hidden lg:flex items-center bg-black/[0.03] border border-black/[0.05] rounded-2xl px-5 py-2 mr-2 shadow-inner shadow-black/[0.02]">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] font-mono">Deployment: Stable</span>
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowProfileMenu((v) => !v)}
                        className="group flex items-center gap-3.5 p-1.5 pr-4 rounded-2xl bg-black/[0.03] border border-black/[0.05] hover:border-primary/30 hover:bg-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                        aria-expanded={showProfileMenu}
                    >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#506ef8] to-[#3d59e0] flex items-center justify-center text-white text-[13px] font-black shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform uppercase font-head">
                            {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                        </div>
                        <div className="hidden sm:block text-left">
                           <p className="text-[13px] font-black text-text-primary leading-none mb-1 tracking-tight">{profile?.full_name?.split(' ')[0] || 'User'}</p>
                           <div className="flex items-center gap-1">
                               <span className="text-[9px] font-black text-primary uppercase tracking-widest font-mono opacity-80">Online</span>
                               <ChevronDown className={clsx("w-3 h-3 text-text-muted transition-transform duration-300", showProfileMenu && "rotate-180")} strokeWidth={2.5} />
                           </div>
                        </div>
                    </button>

                    {showProfileMenu && (
                        <div
                            role="menu"
                            className="absolute right-0 top-full mt-4 w-72 glass border border-black/[0.08] rounded-3xl shadow-xl py-2 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right backdrop-blur-3xl"
                        >
                            <div className="px-6 py-5 border-b border-black/[0.05] bg-black/[0.01]">
                                <p className="text-[15px] font-black text-text-primary truncate font-head tracking-tight leading-none mb-1.5">{profile?.full_name || 'No Name'}</p>
                                <p className="text-[11px] text-text-muted font-bold truncate opacity-70 font-mono">{profile?.email || user?.email}</p>
                                <div className="mt-4 inline-flex items-center px-3 py-1 rounded-xl bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] border border-primary/10">
                                    Auth: {profile?.role || 'User'}
                                </div>
                            </div>
                            
                            <div className="p-2">
                                <button
                                    ref={logoutButtonRef}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        closeMenu();
                                        void handleLogout();
                                    }}
                                    className="w-full flex items-center gap-4 px-4 py-3.5 text-[12px] font-black text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all group focus:outline-none uppercase tracking-[0.2em]"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-rose-500/5 flex items-center justify-center group-hover:bg-rose-500/10 transition-colors">
                                        <LogOut className="w-4.5 h-4.5 shrink-0 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
                                    </div>
                                    Sync Exit
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

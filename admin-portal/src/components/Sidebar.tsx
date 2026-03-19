import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, ChevronLeft, Star, Zap, LogOut } from 'lucide-react';
import { navStructure, matchActive, type BadgeType, type Role } from '../nav/navModel';
import { useFavorites } from '../context/FavoritesContext';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_WIDTH_EXPANDED = 260;
const SIDEBAR_WIDTH_COLLAPSED = 72;

export interface SidebarProps {
    /** When true, sidebar is shown as mobile overlay (always expanded, no collapse toggle). */
    overlay?: boolean;
    /** Called when overlay should close (e.g. backdrop click). */
    onOverlayClose?: () => void;
}

export function Sidebar({ overlay = false, onOverlayClose }: SidebarProps = {}) {
    const location = useLocation();
    const { favorites } = useFavorites();
    const { profile, signOut } = useAuth();
    const userRole = (profile?.role || 'User') as Role;
    
    const [collapsed, setCollapsed] = useState(false);
    const effectiveCollapsed = overlay ? false : collapsed;
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [favoritesExpanded, setFavoritesExpanded] = useState(true);

    // Filtered nav structure based on roles
    const filteredNav = useMemo(() => {
        return navStructure
            .map(group => {
                if (group.children) {
                    const allowedChildren = group.children.filter(child => 
                        !child.allowedRoles || child.allowedRoles.includes(userRole)
                    );
                    return { ...group, children: allowedChildren };
                }
                return { ...group };
            })
            .filter(group => {
                if (group.allowedRoles && !group.allowedRoles.includes(userRole)) return false;
                if (group.children && group.children.length === 0) return false;
                return true;
            }) as typeof navStructure;
    }, [userRole]);

    useEffect(() => {
        const currentPath = location.pathname;
        const newExpanded = { ...expandedGroups };
        let changed = false;

        filteredNav.forEach(group => {
            if (group.children) {
                const isChildActive = group.children.some(child => matchActive(currentPath, child.path));
                if (isChildActive && !newExpanded[group.name]) {
                    newExpanded[group.name] = true;
                    changed = true;
                }
            }
        });

        if (changed) {
            setExpandedGroups(newExpanded);
        }
    }, [location.pathname, filteredNav]);

    const toggleGroup = (name: string) => {
        setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const renderBadge = (badge?: BadgeType) => {
        if (!badge || effectiveCollapsed) return null;
        if (badge === 'new') {
            return (
                <span className="flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-black uppercase px-2 py-0.5 rounded-full ml-2 shrink-0 tracking-widest">
                    New
                </span>
            );
        }
        if (badge === 'bolt') {
            return <Zap className="w-3.5 h-3.5 text-primary ml-2 shrink-0 fill-primary" aria-hidden />;
        }
        return null;
    };

    return (
        <aside
            className={clsx(
                "h-full glass border-r border-black/[0.05] flex flex-col overflow-y-auto shell-scrollbar shadow-xl shadow-[#293d63]/5",
                overlay ? "w-[280px]" : "sticky top-0 transition-[width] duration-300 ease-in-out"
            )}
            style={overlay ? undefined : { width: effectiveCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
            aria-label="Main navigation"
        >
            {/* Logo Area */}
            <div className={clsx("flex items-center sticky top-0 z-20 backdrop-blur-3xl bg-white/40 border-b border-black/[0.05]", effectiveCollapsed ? "justify-center px-0 py-5" : "px-6 py-5 gap-3.5")}>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#506ef8] to-[#3d59e0] flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                     <div className="w-4.5 h-4.5 border-[2.5px] border-white rounded-[2px] rotate-45" aria-hidden />
                </div>
                {!effectiveCollapsed && (
                    <div className="flex flex-col">
                        <span className="text-xl font-black text-text-primary tracking-tighter truncate font-head leading-none">Trackora</span>
                        <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-1 opacity-80">Enterprise</span>
                    </div>
                )}
            </div>

            <div className={clsx("flex-1 flex flex-col pt-8", effectiveCollapsed ? "px-2 pb-4" : "px-4 pb-8")}>
                {/* Favorites Section */}
                {!effectiveCollapsed && (
                    <div className="mb-8 px-2">
                        <button
                            type="button"
                            onClick={() => setFavoritesExpanded(!favoritesExpanded)}
                            className="w-full flex items-center justify-between py-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] hover:text-text-primary transition-colors group"
                            aria-expanded={favoritesExpanded}
                        >
                            <div className="flex items-center gap-2.5">
                                <Star className={clsx("w-4 h-4 transition-colors", favorites.length > 0 ? "text-primary fill-primary/10" : "text-text-muted group-hover:text-text-secondary")} aria-hidden />
                                Registry Hub
                                <span className="bg-black/5 px-2 py-0.5 rounded-lg text-[10px] text-text-muted font-mono">{favorites.length}</span>
                            </div>
                            <ChevronDown className={clsx("w-3.5 h-3.5 text-text-muted transition-transform duration-300", !favoritesExpanded && "-rotate-90")} />
                        </button>

                        <div className={clsx(
                            "mt-3 space-y-1.5 overflow-hidden transition-all duration-300",
                            favoritesExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
                        )}>
                            {favorites.length > 0 ? (
                                favorites.map((fav) => (
                                    <Link
                                        key={fav.path}
                                        to={fav.path}
                                        className={clsx(
                                            "flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-xl transition-all group",
                                            location.pathname === fav.path
                                                ? "bg-primary/5 text-primary font-black shadow-sm border border-primary/10"
                                                : "text-text-secondary hover:text-text-primary hover:bg-black/[0.02]"
                                        )}
                                    >
                                        <div className={clsx("w-2 h-2 rounded-full", location.pathname === fav.path ? "bg-primary" : "bg-black/10 group-hover:bg-primary/30")} />
                                        <span className="truncate tracking-tight font-bold">{fav.name}</span>
                                    </Link>
                                ))
                            ) : (
                                <p className="px-3 py-2.5 text-[11px] text-text-muted italic opacity-60 font-medium">No identified clusters.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Main Navigation */}
                <nav className="space-y-2" aria-label="Primary">
                    {!effectiveCollapsed && (
                        <p className="px-4 text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-4 opacity-40">Operational Matrix</p>
                    )}
                    {filteredNav.map((group) => {
                        const hasChildren = group.children && group.children.length > 0;
                        const isExpanded = !effectiveCollapsed && expandedGroups[group.name];
                        const isDirectlyActive = group.path && location.pathname === group.path;
                        const isChildActive = hasChildren && group.children?.some(c => matchActive(location.pathname, c.path));

                        return (
                            <div key={group.name} className="flex flex-col">
                                {hasChildren ? (
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(group.name)}
                                        className={clsx(
                                            'group flex items-center rounded-2xl text-[14px] font-bold transition-all',
                                            effectiveCollapsed ? 'justify-center p-3.5 w-full' : 'justify-between px-4 py-3 w-full',
                                            isChildActive && !isExpanded ? 'bg-primary/5 text-primary border border-primary/10 shadow-sm' : 
                                            isExpanded ? 'text-text-primary bg-black/[0.02]' : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.02]'
                                        )}
                                        aria-expanded={isExpanded}
                                    >
                                        <div className={clsx("flex items-center gap-3.5", effectiveCollapsed && "justify-center")}>
                                            <group.icon className={clsx("w-[20px] h-[20px] shrink-0 transition-colors", 
                                                isChildActive || isExpanded ? "text-primary" : "text-text-muted group-hover:text-primary")} 
                                                strokeWidth={2.5} aria-hidden />
                                            {!effectiveCollapsed && <span className="tracking-tight">{group.name}</span>}
                                        </div>
                                        {!effectiveCollapsed && (
                                            <ChevronDown className={clsx("w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-300", !isExpanded && "-rotate-90")} />
                                        )}
                                    </button>
                                ) : (
                                    <Link
                                        to={group.path!}
                                        className={clsx(
                                            'group flex items-center rounded-2xl text-[14px] font-bold transition-all relative overflow-hidden',
                                            effectiveCollapsed ? 'justify-center p-3.5' : 'px-4 py-3 gap-3.5',
                                            isDirectlyActive 
                                                ? 'bg-primary/5 text-primary border border-primary/10 shadow-sm' 
                                                : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.02]'
                                        )}
                                    >
                                        {isDirectlyActive && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-r-full" aria-hidden />
                                        )}
                                        <group.icon className={clsx("w-[20px] h-[20px] shrink-0 transition-colors", 
                                            isDirectlyActive ? "text-primary" : "text-text-muted group-hover:text-primary")} 
                                            strokeWidth={2.5} aria-hidden />
                                        {!effectiveCollapsed && <span className="tracking-tight">{group.name}</span>}
                                    </Link>
                                )}

                                {hasChildren && isExpanded && (
                                    <div className="mt-1 pb-2 space-y-1 relative ml-10 border-l border-black/[0.05] pl-3 animate-in slide-in-from-top-1 duration-200">
                                        {group.children!.map((child) => {
                                            const isActive = matchActive(location.pathname, child.path);
                                            return (
                                                <Link
                                                    key={child.name}
                                                    to={child.path}
                                                    className={clsx(
                                                        'flex items-center justify-between px-3 py-2.5 text-[13px] rounded-xl transition-all group',
                                                        isActive 
                                                            ? 'text-primary font-black bg-primary/5' 
                                                            : 'text-text-secondary hover:bg-black/[0.01] hover:text-text-primary'
                                                    )}
                                                >
                                                    <span className="truncate tracking-tight">{child.name}</span>
                                                    {renderBadge(child.badge)}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* Profile Area */}
            <div className="mt-auto border-t border-black/[0.05] bg-white/40 p-5 relative z-20">
                 <div className={clsx("flex items-center gap-3.5 p-2 rounded-2xl transition-all hover:bg-black/[0.02] cursor-pointer group mb-3", effectiveCollapsed ? "justify-center" : "")}>
                    <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#506ef8] to-[#3d59e0] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-primary/20 uppercase font-head">
                            {profile?.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                    </div>
                    {!effectiveCollapsed && (
                        <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-black text-text-primary truncate font-head leading-none mb-1">{profile?.full_name}</p>
                            <p className="text-[10px] text-primary font-black uppercase tracking-widest opacity-80 font-mono">Role: {profile?.role}</p>
                        </div>
                    )}
                </div>
                
                <button
                    type="button"
                    onClick={() => signOut()}
                    className={clsx(
                        "w-full flex items-center rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] text-rose-500 hover:bg-rose-500/10 transition-all group py-1",
                        effectiveCollapsed ? "justify-center p-3.5" : "px-4 py-3 gap-3.5"
                    )}
                >
                    <LogOut className="w-[18px] h-[18px] shrink-0 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2.5} />
                    {!effectiveCollapsed && <span>De-sync Session</span>}
                </button>
            </div>

            {/* Collapse toggle */}
            {!overlay && (
                 <div className="border-t border-black/[0.05] bg-white/40 px-4 py-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => setCollapsed(c => !c)}
                        className="w-full flex items-center justify-center p-2.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-black/[0.02] transition-all border border-transparent"
                    >
                        <ChevronLeft className={clsx("w-4 h-4 transition-transform duration-500", effectiveCollapsed && "rotate-180")} strokeWidth={2.5} />
                    </button>
                </div>
            )}
        </aside>
    );
}

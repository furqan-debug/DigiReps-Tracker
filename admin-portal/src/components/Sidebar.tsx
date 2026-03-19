import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, ChevronLeft, Star, Zap, LogOut } from 'lucide-react';
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

    // Filtered nav structure based on roles (immutably)
    const filteredNav = useMemo(() => {
        return navStructure
            .map(group => {
                // If group has children, return a copy with filtered children
                if (group.children) {
                    const allowedChildren = group.children.filter(child => 
                        !child.allowedRoles || child.allowedRoles.includes(userRole)
                    );
                    return { ...group, children: allowedChildren };
                }
                return { ...group };
            })
            .filter(group => {
                // Check group-level permissions
                if (group.allowedRoles && !group.allowedRoles.includes(userRole)) return false;

                // If a group should have children but none are allowed, hide the group
                if (group.children && group.children.length === 0) return false;

                return true;
            }) as typeof navStructure;
    }, [userRole]);

    // Auto-expand groups based on the current active path
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
                <span className="flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0">
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
                "h-full glass border-r border-border flex flex-col overflow-y-auto shell-scrollbar",
                overlay ? "w-[260px]" : "sticky top-0 transition-[width] duration-200 ease-out"
            )}
            style={overlay ? undefined : { width: effectiveCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
            aria-label="Main navigation"
        >
            {/* Logo Area */}
            <div className={clsx("flex items-center sticky top-0 z-10 glass border-b border-border/50", effectiveCollapsed ? "justify-center px-0 py-4" : "px-4 py-4 gap-2.5")}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                    <div className="w-4 h-4 border-2 border-white rounded-sm rotate-45" aria-hidden />
                </div>
                {!effectiveCollapsed && <span className="text-lg font-bold text-text-primary tracking-tight truncate font-head">Trackora</span>}
            </div>

            <div className={clsx("flex-1 flex flex-col", effectiveCollapsed ? "px-2 pb-4" : "px-3 pb-6")}>
                {/* Favorites Section */}
                {!effectiveCollapsed && (
                    <>
                        <div className="mb-2 mt-3">
                            <button
                                type="button"
                                onClick={() => setFavoritesExpanded(!favoritesExpanded)}
                                className="w-full flex items-center justify-between px-2 py-2 rounded-shell-md text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle"
                                aria-expanded={favoritesExpanded}
                                aria-label={favoritesExpanded ? "Collapse favorites" : "Expand favorites"}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Star className="w-4 h-4 text-text-muted" aria-hidden />
                                    Favorites ({favorites.length})
                                </div>
                                {favoritesExpanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" aria-hidden /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" aria-hidden />}
                            </button>

                            {favoritesExpanded && favorites.length > 0 && (
                                <div className="mt-0.5 ml-4 space-y-0.5">
                                    {favorites.map((fav) => (
                                        <Link
                                            key={fav.path}
                                            to={fav.path}
                                            onClick={overlay ? () => onOverlayClose?.() : undefined}
                                            className={clsx(
                                                "block px-3 py-2 text-[13px] rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40",
                                                location.pathname === fav.path
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                                            )}
                                        >
                                            {fav.name}
                                        </Link>
                                    ))}
                                </div>
                            )}

                            {favoritesExpanded && favorites.length === 0 && (
                                <div className="mt-0.5 ml-4 px-3 py-2 text-[11px] text-text-muted italic">
                                    No favorites yet.
                                </div>
                            )}
                        </div>
                        <div className="w-full h-px bg-border-subtle my-2" aria-hidden />
                    </>
                )}

                {/* Main Navigation */}
                <nav className={clsx("space-y-0.5", !effectiveCollapsed && "mt-1")} aria-label="Primary">
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
                                            'flex items-center rounded-shell-md text-[13.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle',
                                            effectiveCollapsed ? 'justify-center p-2 w-full' : 'justify-between px-2 py-2 w-full',
                                            isChildActive && !isExpanded ? 'text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                                        )}
                                        aria-expanded={isExpanded}
                                        aria-label={effectiveCollapsed ? group.name : undefined}
                                    >
                                        <div className={clsx("flex items-center gap-3", effectiveCollapsed && "justify-center")}>
                                            <group.icon className={clsx("w-[18px] h-[18px] shrink-0", isChildActive ? "text-primary" : "text-text-muted group-hover:text-text-secondary")} strokeWidth={2} aria-hidden />
                                            {!effectiveCollapsed && group.name}
                                        </div>
                                        {!effectiveCollapsed && (isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" aria-hidden /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" aria-hidden />)}
                                    </button>
                                ) : (
                                    <Link
                                        to={group.path!}
                                        onClick={overlay ? () => onOverlayClose?.() : undefined}
                                        className={clsx(
                                            'flex items-center rounded-md text-[13.5px] font-medium transition-all focus:outline-none focus:ring-1 focus:ring-primary/40',
                                            effectiveCollapsed ? 'justify-center p-2' : 'px-2 py-2 gap-3',
                                            isDirectlyActive ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                                        )}
                                        aria-current={isDirectlyActive ? 'page' : undefined}
                                    >
                                        <group.icon className={clsx("w-4 h-4 shrink-0", isDirectlyActive ? "text-primary" : "text-text-muted")} strokeWidth={2.5} aria-hidden />
                                        {!effectiveCollapsed && group.name}
                                    </Link>
                                )}

                                {hasChildren && isExpanded && (
                                    <div className="mt-0.5 pb-2 space-y-0.5 relative">
                                        <div className="absolute left-[17px] top-0 bottom-2 w-px bg-border" aria-hidden />

                                        {group.children!.map((child) => {
                                            const isActive = matchActive(location.pathname, child.path);
                                            return (
                                                <Link
                                                    key={child.name}
                                                    to={child.path}
                                                    onClick={overlay ? () => onOverlayClose?.() : undefined}
                                                    className={clsx(
                                                        'flex items-center justify-between ml-[30px] px-3 py-2 text-[13px] rounded-md transition-all relative focus:outline-none ',
                                                        isActive ? 'bg-surface-hover text-text-primary font-semibold' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                                                    )}
                                                    aria-current={isActive ? 'page' : undefined}
                                                >
                                                    {isActive && (
                                                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-full" aria-hidden />
                                                    )}
                                                    <span className="truncate">{child.name}</span>
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

            {/* Profile & Logout Area */}
            <div className="mt-auto border-t border-border bg-surface/30 p-3">
                 <div className={clsx("flex items-center gap-3", effectiveCollapsed ? "justify-center" : "px-1 mb-3")}>
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs shrink-0 border border-indigo-500/10">
                        {profile?.full_name?.charAt(0) || '?'}
                    </div>
                    {!effectiveCollapsed && (
                        <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-text-primary truncate">{profile?.full_name}</p>
                            <p className="text-[10px] text-text-muted truncate capitalize font-medium">{profile?.role}</p>
                        </div>
                    )}
                </div>
                
                <button
                    type="button"
                    onClick={() => signOut()}
                    className={clsx(
                        "w-full flex items-center rounded-md text-[13px] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors focus:outline-none",
                        effectiveCollapsed ? "justify-center p-2" : "px-2 py-2 gap-3"
                    )}
                    aria-label="Sign out"
                >
                    <LogOut className="w-4 h-4 shrink-0" aria-hidden />
                    {!effectiveCollapsed && <span>Sign out</span>}
                </button>
            </div>

            {/* Collapse toggle (desktop only) */}
            {!overlay && (
                <div className="sticky bottom-0 border-t border-border bg-surface/30 p-2">
                    <button
                        type="button"
                        onClick={() => setCollapsed(c => !c)}
                        className="w-full flex items-center justify-center p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors focus:outline-none"
                        aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <ChevronLeft className={clsx("w-4 h-4 transition-transform", effectiveCollapsed && "rotate-180")} aria-hidden />
                    </button>
                </div>
            )}
        </aside>
    );
}

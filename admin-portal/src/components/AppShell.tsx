import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') setMobileMenuOpen(false);
        }
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    return (
        <div className="flex h-screen bg-background text-text-secondary overflow-hidden font-sans relative">
            {/* Ambient Background Accents */}
            <div className="absolute inset-0 bg-gradient-mesh pointer-events-none z-0 opacity-100" />
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none z-0" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none z-0" />
            
            {/* Desktop sidebar: visible from md up */}
            <div className="hidden md:block shrink-0 relative z-10 h-full">
                <Sidebar />
            </div>

            {/* Mobile overlay: sidebar + backdrop when menu open */}
            {mobileMenuOpen && (
                <>
                    <div
                        role="presentation"
                        className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm md:hidden transition-opacity duration-300"
                        aria-hidden
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 z-40 w-[280px] md:hidden animate-in slide-in-from-left duration-300 shadow-2xl">
                        <Sidebar overlay onOverlayClose={() => setMobileMenuOpen(false)} />
                    </div>
                </>
            )}

            <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 relative z-10">
                <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />
                <main className="flex-1 overflow-y-auto shell-scrollbar">
                    {children}
                </main>
            </div>
        </div>
    );
}

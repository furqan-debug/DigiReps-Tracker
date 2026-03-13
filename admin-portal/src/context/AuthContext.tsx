import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface MemberProfile {
    id: string;
    email: string;
    full_name: string;
    role: 'Admin' | 'Manager' | 'User' | 'Viewer';
    status: 'Active' | 'Inactive' | 'Pending';
    organization_id: string | null;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: MemberProfile | null;
    loading: boolean;
    error: string | null;
    refreshProfile: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<MemberProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 1. Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchProfile(session.user.email!);
            else setLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchProfile(session.user.email!);
            else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchProfile(email: string) {
        try {
            // Use case-insensitive match just in case
            // Use maybeSingle to avoid errors if the member record doesn't exist yet
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .ilike('email', email)
                .maybeSingle();

            if (error) {
                console.warn('Profile fetch error for:', email, error.message);
                setError(error.message);
                return; 
            }
            
            if (!data) {
                console.log('No member profile record found for:', email);
                setProfile(null);
                setError(null); // Clear any previous error
                // We don't necessarily treat this as a blocking error in the context, 
                // components can decide how to handle a null profile.
            } else {
                setProfile(data);
                setError(null);
            }
        } catch (err: any) {
            console.error('Error fetching profile:', err);
            setError(err.message || 'Unknown error fetching profile');
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const refreshProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
            const { data: member } = await supabase
                .from('members')
                .select('*')
                .ilike('email', session.user.email)
                .single();
            setProfile(member);
        } else {
            setProfile(null);
        }
    };

    return (
        <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, error, refreshProfile, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

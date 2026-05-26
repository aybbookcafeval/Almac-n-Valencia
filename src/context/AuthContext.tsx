import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { Profile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchingIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string, email?: string) => {
    if (fetchingIdRef.current === userId) {
      console.log('Profile fetch already in flight for:', userId);
      return;
    }
    fetchingIdRef.current = userId;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Profile not found, auto-creating profile for:', userId, email);
          const role = (email === 'aybbookcafeval@gmail.com' || email?.toLowerCase().includes('admin')) ? 'admin' : 'user';
          const newProfile = {
            id: userId,
            email: email || '',
            role: role
          };
          
          const { data: insertedData, error: insertError } = await supabase
            .from('profiles')
            .insert([newProfile])
            .select('*')
            .single();
            
          if (insertError) {
            console.error('Error auto-creating profile:', insertError);
            setProfile({
              id: userId,
              email: email || '',
              role: role,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            return;
          }
          
          setProfile(insertedData);
          return;
        }
        throw error;
      }
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile({
        id: userId,
        email: email || '',
        role: (email === 'aybbookcafeval@gmail.com' || email?.toLowerCase().includes('admin')) ? 'admin' : 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } finally {
      if (fetchingIdRef.current === userId) {
        fetchingIdRef.current = null;
      }
    }
  };

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        currentUserIdRef.current = currentUser?.id ?? null;

        if (currentUser) {
          await fetchProfile(currentUser.id, currentUser.email);
        }
      } catch (err) {
        console.error('Error during initial session check:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      
      const currentUser = session?.user ?? null;
      const prevUserId = currentUserIdRef.current;
      currentUserIdRef.current = currentUser?.id ?? null;
      
      setUser(currentUser);
      
      if (currentUser) {
        if (currentUser.id === prevUserId && profile) {
          // If profile is already fetched, skip redundant loading triggers
          setLoading(false);
          return;
        }
        
        try {
          await fetchProfile(currentUser.id, currentUser.email);
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      } else {
        if (active) {
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [profile]); // Include profile to allow checking its existence on subsequent auth states

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAdmin: profile?.role === 'admin',
      signIn, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

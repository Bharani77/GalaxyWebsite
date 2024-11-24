'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { checkSession } from '@/utils/auth';
import { toast } from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SessionContext = createContext<{
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  username: string | null;
  token: string | null;
}>({
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  username: null,
  token: null,
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Function to handle database changes
  const handleDatabaseChanges = async (payload: any) => {
    console.log('Real-time change detected:', payload);
    const session = JSON.parse(localStorage.getItem('session') || '{}');

    if (!session || !session.username) {
      return;
    }

    // Handle user deletion
    if (payload.eventType === 'DELETE') {
      if (payload.old_record && payload.old_record.username === session.username) {
        console.log('User deleted, showing notification');
        localStorage.removeItem('session');
        
        setIsAuthenticated(false);
        setIsAdmin(false);
        setUsername(null);
        setToken(null);

        toast.remove();
        toast.error('Your access has been revoked by admin', {
          duration: 5000,
          position: 'top-center',
          style: {
            background: '#ff4b4b',
            color: '#fff',
            fontSize: '16px',
            padding: '16px',
            maxWidth: '500px',
            textAlign: 'center'
          },
        });

        router.replace('/');
        return;
      }
    }

    // Handle token removal or modification
    if (payload.eventType === 'UPDATE' && 
        payload.old_record.username === session.username && 
        (!payload.new_record.token || payload.new_record.token !== payload.old_record.token)) {
      console.log('Token modified, showing notification');
      localStorage.removeItem('session');
      
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUsername(null);
      setToken(null);

      toast.remove();
      toast.error('Your access token has been modified by admin', {
        duration: 5000,
        position: 'top-center',
        style: {
          background: '#ff4b4b',
          color: '#fff',
          fontSize: '16px',
          padding: '16px',
          maxWidth: '500px',
          textAlign: 'center'
        },
      });

      router.replace('/');
      return;
    }

    // For other changes affecting current user
    if (payload.new_record && payload.new_record.username === session.username) {
      validateSession();
    }
  };

  const handleSessionChanges = async (payload: any) => {
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    if (!session || !session.sessionId) return;

    console.log('Session change detected:', {
      eventType: payload.eventType,
      currentSessionId: session.sessionId,
      payloadSessionId: payload.new_record?.session_id,
      userId: session.userId
    });

    // If any session was created or updated for the same user
    if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && 
        payload.new_record.user_id === session.userId) {
      
      // If this is not our session
      if (payload.new_record.session_id !== session.sessionId) {
        console.log('Another session detected, checking if it is newer');
        
        // If the other session is newer and active, invalidate current session
        if (payload.new_record.is_active && 
            new Date(payload.new_record.created_at) > new Date(session.created_at)) {
          console.log('Newer active session found, invalidating current session');
          
          localStorage.removeItem('session');
          setIsAuthenticated(false);
          setIsAdmin(false);
          setUsername(null);
          setToken(null);

          toast.error('Your session has ended because you signed in from another browser', {
            duration: 5000,
            position: 'top-center',
            style: {
              background: '#ff4b4b',
              color: '#fff',
              fontSize: '16px',
              padding: '16px',
              maxWidth: '500px',
              textAlign: 'center'
            },
          });

          router.replace('/signin');
        }
      }
    }

    // If our session was deactivated
    if (payload.eventType === 'UPDATE' && 
        payload.old_record.session_id === session.sessionId && 
        !payload.new_record.is_active) {
      console.log('Current session was deactivated');
      
      localStorage.removeItem('session');
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUsername(null);
      setToken(null);

      toast.error('Your session was deactivated', {
        duration: 5000,
        position: 'top-center',
        style: {
          background: '#ff4b4b',
          color: '#fff',
          fontSize: '16px',
          padding: '16px',
          maxWidth: '500px',
          textAlign: 'center'
        },
      });

      router.replace('/signin');
    }
  };

  const validateSession = async () => {
    try {
      console.log('Starting session validation');
      const sessionData = await checkSession();
      
      if (sessionData) {
        console.log('Session validated successfully:', {
          ...sessionData,
          token: '[REDACTED]'
        });
        
        setIsAuthenticated(true);
        setIsAdmin(sessionData.isAdmin);
        setUsername(sessionData.username);
        setToken(sessionData.token || null);

        // Handle admin routing
        if (sessionData.isAdmin) {
          if (pathname === '/') {
            router.push('/admin');
          }
        } else {
          if (pathname.startsWith('/admin')) {
            router.replace('/');
          }
        }
      } else {
        console.log('No valid session found');
        setIsAuthenticated(false);
        setIsAdmin(false);
        setUsername(null);
        setToken(null);

        // Redirect to signin if trying to access protected routes
        if (pathname !== '/signin' && pathname !== '/signup') {
          router.replace('/signin');
        }
      }
    } catch (error: any) {
      console.error('Session validation error:', error);
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUsername(null);
      setToken(null);

      toast.error(error.message || 'Session validation failed', {
        duration: 5000,
        position: 'top-center',
      });

      if (pathname !== '/signin' && pathname !== '/signup') {
        router.replace('/signin');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set up real-time subscription for both users and sessions
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    if (!session || !session.userId) return;

    console.log('Setting up real-time subscriptions for user:', session.userId);

    const subscription = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `username=eq.${session.username}`
        },
        handleDatabaseChanges
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `user_id=eq.${session.userId}`
        },
        handleSessionChanges
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Initial session validation
    validateSession();

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up subscriptions');
      subscription.unsubscribe();
    };
  }, [pathname]);

  useEffect(() => {
    let mounted = true;
    let validationTimeout: NodeJS.Timeout;

    // Function to run validation with delay
    const runValidation = async () => {
      if (!mounted) return;
      
      try {
        await validateSession();
      } catch (error: any) {
        console.error('Validation error:', error);
        
        // Show error message if not on signin page
        if (pathname !== '/signin') {
          toast.error(error.message, {
            duration: 5000,
            position: 'top-center',
          });
          router.replace('/');
        }
      }

      // Schedule next validation
      validationTimeout = setTimeout(runValidation, 3000); // Check every 3 seconds
    };

    // Initial validation
    runValidation();

    // Cleanup
    return () => {
      mounted = false;
      clearTimeout(validationTimeout);
    };
  }, [pathname]);

  return (
    <SessionContext.Provider value={{ isLoading, isAuthenticated, isAdmin, username, token }}>
      {children}
    </SessionContext.Provider>
  );
}

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { getDeviceFingerprint } from './fingerprint';

// Create a Supabase client with the service role key for admin operations
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Create a separate client with service role for session management
export const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export interface UserSession {
  username: string;
  isLoggedIn: boolean;
  tokenExpiry?: string;
  token?: string | null;
  isAdmin?: boolean;
  deviceFingerprint?: string;
  userId?: string;
  sessionId?: string;
}

// Function to create a new session
async function createSession(userId: string, deviceFingerprint: string): Promise<string> {
  try {
    console.log('Creating new session for user:', userId);
    const sessionId = uuidv4();

    // First, deactivate any existing sessions for this user
    const { error: deactivateError } = await adminSupabase
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (deactivateError) {
      console.error('Error deactivating existing sessions:', deactivateError);
      throw new Error('Failed to deactivate existing sessions');
    }

    // Wait a moment to ensure the deactivation is complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create new session using admin client
    const { error: createError } = await adminSupabase
      .from('sessions')
      .insert([{
        user_id: userId,
        session_id: sessionId,
        device_fingerprint: deviceFingerprint,
        is_active: true,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      }]);

    if (createError) {
      console.error('Error creating session:', createError);
      throw new Error('Failed to create session');
    }

    // Verify the session was created and is the only active one
    const { data: activeSessions, error: checkError } = await adminSupabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (checkError) {
      console.error('Error checking active sessions:', checkError);
      throw new Error('Failed to verify session creation');
    }

    if (!activeSessions || activeSessions.length === 0) {
      throw new Error('Failed to create session - no active sessions found');
    }

    if (activeSessions.length > 1) {
      // If somehow multiple active sessions exist, deactivate all but the newest one
      const newestSession = activeSessions.reduce((newest, current) => 
        new Date(current.created_at) > new Date(newest.created_at) ? current : newest
      );

      await adminSupabase
        .from('sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .neq('id', newestSession.id);

      if (newestSession.session_id !== sessionId) {
        throw new Error('Another session was created simultaneously');
      }
    }

    console.log('Successfully created session with ID:', sessionId);
    return sessionId;

  } catch (error) {
    console.error('Session creation error:', error);
    throw error;
  }
}

// Function to check if user has an active session
async function checkActiveSession(userId: string): Promise<boolean> {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Error checking active session:', error);
    return false;
  }

  return !!sessions;
}

// Function to validate session
export async function validateSession(sessionId: string, userId: string): Promise<boolean> {
  try {
    console.log('Validating session:', { sessionId, userId });
    
    // Get current device fingerprint
    const deviceFingerprint = await getDeviceFingerprint();
    
    // Use admin client for session validation
    const { data: session, error } = await adminSupabase
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Session validation error:', error);
      return false;
    }

    if (!session) {
      console.log('No active session found');
      return false;
    }

    // Verify device fingerprint matches
    if (session.device_fingerprint !== deviceFingerprint) {
      console.log('Device fingerprint mismatch');
      // Deactivate this session since it's being accessed from a different browser
      await adminSupabase
        .from('sessions')
        .update({ is_active: false })
        .eq('session_id', sessionId);
      return false;
    }

    console.log('Found active session:', session);

    // Update last_active timestamp using admin client
    const { error: updateError } = await adminSupabase
      .from('sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('Error updating last_active:', updateError);
      // Don't fail validation just because we couldn't update timestamp
    }

    return true;
  } catch (error) {
    console.error('Unexpected error in validateSession:', error);
    return false;
  }
}

// Function to end session
export async function endSession(sessionId: string): Promise<void> {
  await adminSupabase
    .from('sessions')
    .update({ is_active: false })
    .eq('session_id', sessionId);
}

export async function signIn(username: string, password: string): Promise<UserSession> {
  try {
    console.log('Starting sign in process for username:', username);

    // Get current device fingerprint
    const deviceFingerprint = await getDeviceFingerprint();
    console.log('Device fingerprint:', deviceFingerprint);

    // Check if this is an admin login attempt
    if (username === process.env.NEXT_PUBLIC_ADMIN_USERNAME) {
      if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
        const sessionId = uuidv4();
        const adminSession: UserSession = {
          username: username,
          isLoggedIn: true,
          isAdmin: true,
          deviceFingerprint,
          sessionId,
          userId: 'admin' // Special case for admin
        };
        saveSession(adminSession);
        return adminSession;
      }
      throw new Error('Invalid username or password');
    }

    // Normal user authentication
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError || !userData) {
      console.error('User lookup error:', userError);
      throw new Error('Invalid username or password');
    }

    // Check for existing active sessions
    const { data: existingSessions, error: sessionError } = await adminSupabase
      .from('sessions')
      .select('*')
      .eq('user_id', userData.id)
      .eq('is_active', true);

    if (sessionError) {
      console.error('Error checking existing sessions:', sessionError);
    } else if (existingSessions && existingSessions.length > 0) {
      const currentSession = existingSessions[0];
      if (currentSession.device_fingerprint !== deviceFingerprint) {
        throw new Error('You are already logged in from another browser. Please sign out there first.');
      }
    }

    // Create new session
    let sessionId: string;
    try {
      sessionId = await createSession(userData.id, deviceFingerprint);
      console.log('Created new session:', sessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
      throw new Error('Failed to create session. Please try again.');
    }

    const userSession: UserSession = {
      username: userData.username,
      userId: userData.id,
      isLoggedIn: true,
      sessionId,
      token: userData.token,
      deviceFingerprint,
      tokenExpiry: userData.token_expiry
    };

    saveSession(userSession);
    return userSession;

  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
}

export async function signUp(username: string, password: string, token: string): Promise<any> {
  try {
    console.log('Starting sign up process for username:', username);

    // Get device fingerprint
    const deviceFingerprint = await getDeviceFingerprint();
    console.log('Generated device fingerprint:', deviceFingerprint);

    // Check if username already exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    if (userCheckError) {
      console.error('Error checking existing user:', userCheckError);
    }

    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Verify token exists and get expiry date
    const { data: tokenData, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError) {
      console.error('Token verification error:', tokenError);
      throw new Error('Invalid token');
    }

    if (!tokenData) {
      throw new Error('Invalid token');
    }

    // Check if token is already used
    if (tokenData.is_used) {
      throw new Error('Token has already been used');
    }

    // Create new user with device fingerprint
    const newUserData = {
      username,
      password,
      token,
      device_fingerprint: deviceFingerprint,
      created_at: new Date().toISOString(),
      token_expiry: tokenData.expiry_date
    };

    console.log('Attempting to create user with data:', { 
      ...newUserData,
      password: '[REDACTED]',
      token: '[REDACTED]'
    });

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([newUserData])
      .select()
      .single();

    if (createError) {
      console.error('Detailed error creating user:', {
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code
      });
      throw new Error(`Failed to create user account: ${createError.message}`);
    }

    // Mark token as used
    const { error: updateError } = await supabase
      .from('tokens')
      .update({ 
        is_used: true,
        used_by: username
      })
      .eq('token', token);

    if (updateError) {
      console.error('Error updating token status:', updateError);
      // Consider rolling back user creation here
    }

    console.log('Successfully created user:', { 
      ...newUser,
      password: '[REDACTED]',
      token: '[REDACTED]'
    });

    return {
      user: newUser,
      error: null
    };

  } catch (error: any) {
    console.error('Sign up error:', error);
    throw error;
  }
}

export async function signOut() {
  try {
    const session = getSession();
    if (session?.sessionId && session?.userId) {
      // Use admin client for session termination
      const { error } = await adminSupabase
        .from('sessions')
        .update({ is_active: false })
        .eq('session_id', session.sessionId)
        .eq('user_id', session.userId);

      if (error) {
        console.error('Error ending session:', error);
      }
    }
  } catch (error) {
    console.error('Error during sign out:', error);
  } finally {
    clearSession();
  }
}

export function saveSession(user: UserSession) {
  try {
    localStorage.setItem('session', JSON.stringify(user));
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

export function getSession(): UserSession | null {
  try {
    const session = localStorage.getItem('session');
    if (!session) return null;
    return JSON.parse(session);
  } catch (error) {
    console.error('Error reading session:', error);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('session');
}

export async function checkSession() {
  const session = getSession();
  if (!session || !session.isLoggedIn) return null;

  // Check if this is an admin session
  if (session.isAdmin) {
    if (session.username === process.env.NEXT_PUBLIC_ADMIN_USERNAME) {
      return session;
    }
    clearSession();
    return null;
  }

  try {
    console.log('Checking session for user:', session.username);

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', session.username)
      .single();

    if (userError) {
      console.error('User lookup error:', userError);
      // Don't clear session immediately on network errors
      if (userError.code !== 'PGRST116') {
        return session; // Keep session on temporary errors
      }
      clearSession();
      throw new Error('Failed to verify user access');
    }

    if (!userData) {
      clearSession();
      throw new Error('User not found or access revoked');
    }

    // Get token data
    const { data: tokenData, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .eq('token', userData.token)
      .single();

    if (tokenError) {
      console.error('Token lookup error:', tokenError);
      // Don't clear session immediately on network errors
      if (tokenError.code !== 'PGRST116') {
        return session; // Keep session on temporary errors
      }
    }

    if (!tokenData) {
      clearSession();
      throw new Error('Invalid token. Please contact admin.');
    }

    // Check if token is expired
    const expiryDate = new Date(tokenData.expiry_date);
    if (expiryDate < new Date()) {
      clearSession();
      throw new Error('Your access token has expired. Please contact admin for renewal.');
    }

    // Check if token is still active
    if (!tokenData.is_used) {
      clearSession();
      throw new Error('Your token has been deactivated. Please contact admin to reactivate.');
    }

    // Validate session if we have the required data
    if (session.sessionId && session.userId) {
      const isValidSession = await validateSession(session.sessionId, session.userId);
      if (!isValidSession) {
        console.warn('Session validation failed, but keeping session active');
        // Instead of clearing immediately, we'll keep the session
        return session;
      }
    }

    // Update the session with latest data
    const updatedSession = {
      ...session,
      username: userData.username,
      userId: userData.id,
      isLoggedIn: true,
      isAdmin: false,
      token: userData.token,
      deviceFingerprint: session.deviceFingerprint
    };

    // Save the updated session
    saveSession(updatedSession);

    return updatedSession;

  } catch (error: any) {
    console.error('Session check error:', error);
    
    // Only clear session for specific authentication errors
    if (error.message.includes('revoked') || 
        error.message.includes('expired') || 
        error.message.includes('deactivated')) {
      clearSession();
    }
    
    throw error;
  }
}

export function generateToken(duration: string = '1h'): string {
  // Generate a unique token using UUID
  return uuidv4();
}

export async function verifyAdmin(): Promise<boolean> {
  const adminSession = localStorage.getItem('adminSession');
  if (!adminSession) return false;

  try {
    const session = JSON.parse(adminSession);
    return session.username === process.env.NEXT_PUBLIC_ADMIN_USERNAME && session.isLoggedIn === true;
  } catch (error) {
    console.error('Error verifying admin session:', error);
    return false;
  }
}

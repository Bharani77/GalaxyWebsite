'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaUserShield, FaLock, FaKey, FaTrash, FaUsers, FaSync } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { signIn, generateToken } from '@/utils/auth';
import { supabase } from '@/lib/supabase';

interface Token {
  id: string;
  token: string;
  duration: string;
  created_at: string;
  used_by?: string;
  expiry_date: string;
  is_used: boolean;
}

interface User {
  id: string;
  username: string;
  token: string;
  created_at: string;
  expiry_date: string;
  device_fingerprint?: string;
}

export default function Admin() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const adminSession = localStorage.getItem('adminSession');
        if (adminSession) {
          setIsAuthenticated(true);
          await fetchData();
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Set up real-time subscriptions when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Subscribe to users table changes
    const usersSubscription = supabase
      .channel('users-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          console.log('Users change received:', payload);
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to tokens table changes
    const tokensSubscription = supabase
      .channel('tokens-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tokens'
        },
        (payload) => {
          console.log('Tokens change received:', payload);
          fetchData();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      usersSubscription.unsubscribe();
      tokensSubscription.unsubscribe();
    };
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      // Fetch users first
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Fetch tokens with used status
      const { data: tokensData, error: tokensError } = await supabase
        .from('tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (tokensError) throw tokensError;

      // Mark tokens as used if they exist in users table
      const updatedTokens = tokensData.map(token => ({
        ...token,
        is_used: usersData.some(user => user.token === token.token),
        used_by: usersData.find(user => user.token === token.token)?.username
      }));

      // Update state
      setUsers(usersData || []);
      setTokens(updatedTokens || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to refresh data');
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      setUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to refresh users');
    }
  };

  const fetchTokens = async () => {
    try {
      const { data: tokensData, error: tokensError } = await supabase
        .from('tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (tokensError) throw tokensError;

      setTokens(tokensData || []);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast.error('Failed to refresh tokens');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const adminSession = await signIn(loginData.username, loginData.password);
      if (!adminSession.isLoggedIn) throw new Error('Invalid credentials');
      
      localStorage.setItem('adminSession', 'true');
      setIsAuthenticated(true);
      await fetchData();
      toast.success('Welcome, Administrator');
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminSession');
    setIsAuthenticated(false);
    setUsers([]);
    setTokens([]);
    toast.success('Logged out successfully');
  };

  const handleGenerateToken = async (duration: string) => {
    try {
      const token = Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);
      
      let expiryDate = new Date();
      switch (duration) {
        case '3month':
          expiryDate.setMonth(expiryDate.getMonth() + 3);
          break;
        case '6month':
          expiryDate.setMonth(expiryDate.getMonth() + 6);
          break;
        case '1year':
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          break;
      }

      const { error } = await supabase
        .from('tokens')
        .insert([
          {
            token,
            duration,
            expiry_date: expiryDate.toISOString(),
            is_used: false,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;

      toast.success('Token generated successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error generating token:', error);
      toast.error('Failed to generate token');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // First get the user's token
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('token')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Error getting user data:', userError);
        throw userError;
      }

      // If user has a token, delete it from tokens table
      if (userData?.token) {
        const { error: tokenError } = await supabase
          .from('tokens')
          .delete()
          .eq('token', userData.token);

        if (tokenError) {
          console.error('Error deleting token:', tokenError);
          throw tokenError;
        }
      }

      // Then delete the user
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) throw deleteError;

      // Immediately remove session if user deletes themselves
      const session = await supabase.auth.getSession();
      const currentUser = session?.data?.session?.user;
      if (currentUser && currentUser.id === userId) {
        await supabase.auth.signOut();
        router.push('/');
        return;
      }

      toast.success('User and associated token deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleDeleteUserToken = async (userId: string, token: string) => {
    try {
      console.log('Deleting token:', token, 'for user:', userId);

      // First, find the token in the tokens table
      const { data: tokenData, error: findError } = await supabase
        .from('tokens')
        .select('id')
        .eq('token', token)
        .single();

      if (findError) {
        console.error('Error finding token:', findError);
        throw findError;
      }

      console.log('Found token data:', tokenData);

      // Update user's token to empty string
      const { error: userError } = await supabase
        .from('users')
        .update({ token: '' })
        .eq('id', userId);

      if (userError) {
        console.error('Error updating user:', userError);
        throw userError;
      }

      console.log('Updated user token to empty string');

      // Then delete the token from tokens table
      const { error: tokenError } = await supabase
        .from('tokens')
        .delete()
        .eq('id', tokenData.id);

      if (tokenError) {
        console.error('Error deleting token:', tokenError);
        throw tokenError;
      }

      console.log('Deleted token successfully');

      // Check if admin is deleting their own token
      const session = await supabase.auth.getSession();
      const currentUser = session?.data?.session?.user;
      if (currentUser && currentUser.id === userId) {
        console.log('Admin deleted their own token, logging out...');
        await supabase.auth.signOut();
        router.push('/');
        return;
      }

      toast.success('Token deleted successfully');
      await fetchUsers();
      await fetchTokens();
    } catch (error: any) {
      console.error('Failed to delete token:', error);
      toast.error('Failed to delete token: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDeleteUnusedToken = async (tokenId: string) => {
    try {
      const { error } = await supabase
        .from('tokens')
        .delete()
        .eq('id', tokenId);

      if (error) throw error;

      toast.success('Token deleted successfully');
      fetchTokens();
    } catch (error) {
      console.error('Error deleting unused token:', error);
      toast.error('Failed to delete token');
    }
  };

  const handleRenewToken = async (userId: string, oldToken: string, duration: string) => {
    try {
      // Generate new token
      const newToken = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
      
      let expiryDate = new Date();
      switch (duration) {
        case '3month':
          expiryDate.setMonth(expiryDate.getMonth() + 3);
          break;
        case '6month':
          expiryDate.setMonth(expiryDate.getMonth() + 6);
          break;
        case '1year':
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          break;
      }

      // Delete old token if it exists
      if (oldToken) {
        const { error: deleteError } = await supabase
          .from('tokens')
          .delete()
          .eq('token', oldToken);

        if (deleteError) throw deleteError;
      }

      // Create new token
      const { error: tokenError } = await supabase
        .from('tokens')
        .insert([
          {
            token: newToken,
            duration,
            expiry_date: expiryDate.toISOString(),
            is_used: true,
            created_at: new Date().toISOString()
          }
        ]);

      if (tokenError) throw tokenError;

      // Update user with new token
      const { error: userError } = await supabase
        .from('users')
        .update({ token: newToken })
        .eq('id', userId);

      if (userError) throw userError;

      toast.success('Token renewed successfully');
      fetchData();
    } catch (error) {
      console.error('Error renewing token:', error);
      toast.error('Failed to renew token');
    }
  };

  const groupTokensByDuration = () => {
    return tokens.reduce((acc, token) => {
      const duration = token.duration;
      if (!acc[duration]) {
        acc[duration] = [];
      }
      acc[duration].push(token);
      return acc;
    }, {} as Record<string, Token[]>);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const [renewDuration, setRenewDuration] = useState('3month');
  const [activeRenewalUser, setActiveRenewalUser] = useState<string | null>(null);

  // Function to check and handle expired tokens
  const handleExpiredTokens = async () => {
    try {
      // Get all users with tokens
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .not('token', 'is', null);

      if (error) throw error;

      const currentTime = new Date().getTime();

      // Check each user's token
      for (const user of users) {
        if (user.token && user.expiry_date) {
          const expiryTime = new Date(user.expiry_date).getTime();
          
          // If token is expired
          if (currentTime > expiryTime) {
            console.log(`Token expired for user: ${user.username}`);
            
            // Update user record: remove token and mark as expired
            const { error: updateError } = await supabase
              .from('users')
              .update({
                token: null,
                expiry_date: null
              })
              .eq('id', user.id);

            if (updateError) {
              console.error('Error updating expired token:', updateError);
            }

            // Delete token from tokens table
            const { error: tokenError } = await supabase
              .from('tokens')
              .delete()
              .eq('token', user.token);

            if (tokenError) {
              console.error('Error deleting expired token:', tokenError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling expired tokens:', error);
    }
  };

  // Run token expiration check periodically
  useEffect(() => {
    // Initial check
    handleExpiredTokens();

    // Check every minute
    const interval = setInterval(handleExpiredTokens, 60000);

    return () => clearInterval(interval);
  }, []);

  // Add loading screen
  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="gaming-card max-w-md w-full mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-red-500 mb-2">Admin Access</h1>
            <p className="text-gray-400">Secure administration portal</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="gaming-card max-w-md w-full mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-red-500 mb-2">Admin Access</h1>
            <p className="text-gray-400">Secure administration portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-red-400 mb-2">
                <FaUserShield />
                Username
              </label>
              <input
                type="text"
                className="gaming-input"
                value={loginData.username}
                onChange={(e) =>
                  setLoginData({ ...loginData, username: e.target.value })
                }
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-red-400 mb-2">
                <FaLock />
                Password
              </label>
              <input
                type="password"
                className="gaming-input"
                value={loginData.password}
                onChange={(e) =>
                  setLoginData({ ...loginData, password: e.target.value })
                }
                required
              />
            </div>

            <button type="submit" className="gaming-button w-full">
              Access Control Center
            </button>
          </form>
        </div>
      </main>
    );
  }

  const groupedTokens = groupTokensByDuration();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="gaming-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <FaUserShield className="text-blue-400 text-4xl" />
              <div>
                <h1 className="text-2xl font-bold text-red-400 relative">
                  Admin Control Center
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 via-red-500 to-blue-500 rounded-full shadow-lg"></div>
                </h1>
                <p className="text-gray-400">Manage users and tokens</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="gaming-button px-4 py-2 bg-black/30 hover:bg-black/40 border border-blue-500/50"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Token Generation and Display Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 3 Month Tokens */}
          <div className="gaming-card border-2 border-blue-500/70 h-[300px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-red-400">3 Month Tokens</h2>
              <button
                onClick={() => handleGenerateToken('3month')}
                className="gaming-button px-4 py-2"
              >
                Generate
              </button>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <div className="space-y-2">
                {groupedTokens['3month']?.map((token) => {
                  const isUsed = token.is_used;
                  return (
                    <div 
                      key={token.id} 
                      className={`bg-black/30 p-3 rounded-lg text-sm ${
                        isUsed ? 'border border-red-500/50' : 'border border-green-500/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className={isUsed ? 'text-red-500' : 'text-green-500'}>
                            {token.token}
                          </p>
                          <p className={`text-sm ${isUsed ? 'text-red-400' : 'text-gray-400'}`}>
                            Status: {isUsed ? 'Used' : 'Available'}
                          </p>
                          <p className="text-gray-400">
                            Expires: {new Date(token.expiry_date).toLocaleDateString()}
                          </p>
                          {token.used_by && (
                            <p className="text-red-400 text-sm">
                              Used by: {token.used_by}
                            </p>
                          )}
                        </div>
                        {!isUsed && (
                          <button
                            onClick={() => handleDeleteUnusedToken(token.id)}
                            className="text-red-500 hover:text-red-400"
                            title="Delete Token"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6 Month Tokens */}
          <div className="gaming-card border-2 border-blue-500/70 h-[300px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-red-400">6 Month Tokens</h2>
              <button
                onClick={() => handleGenerateToken('6month')}
                className="gaming-button px-4 py-2"
              >
                Generate
              </button>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <div className="space-y-2">
                {groupedTokens['6month']?.map((token) => {
                  const isUsed = token.is_used;
                  return (
                    <div 
                      key={token.id} 
                      className={`bg-black/30 p-3 rounded-lg text-sm ${
                        isUsed ? 'border border-red-500/50' : 'border border-green-500/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className={isUsed ? 'text-red-500' : 'text-green-500'}>
                            {token.token}
                          </p>
                          <p className={`text-sm ${isUsed ? 'text-red-400' : 'text-gray-400'}`}>
                            Status: {isUsed ? 'Used' : 'Available'}
                          </p>
                          <p className="text-gray-400">
                            Expires: {new Date(token.expiry_date).toLocaleDateString()}
                          </p>
                          {token.used_by && (
                            <p className="text-red-400 text-sm">
                              Used by: {token.used_by}
                            </p>
                          )}
                        </div>
                        {!isUsed && (
                          <button
                            onClick={() => handleDeleteUnusedToken(token.id)}
                            className="text-red-500 hover:text-red-400"
                            title="Delete Token"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 1 Year Tokens */}
          <div className="gaming-card border-2 border-blue-500/70 h-[300px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-red-400">1 Year Tokens</h2>
              <button
                onClick={() => handleGenerateToken('1year')}
                className="gaming-button px-4 py-2"
              >
                Generate
              </button>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <div className="space-y-2">
                {groupedTokens['1year']?.map((token) => {
                  const isUsed = token.is_used;
                  return (
                    <div 
                      key={token.id} 
                      className={`bg-black/30 p-3 rounded-lg text-sm ${
                        isUsed ? 'border border-red-500/50' : 'border border-green-500/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className={isUsed ? 'text-red-500' : 'text-green-500'}>
                            {token.token}
                          </p>
                          <p className={`text-sm ${isUsed ? 'text-red-400' : 'text-gray-400'}`}>
                            Status: {isUsed ? 'Used' : 'Available'}
                          </p>
                          <p className="text-gray-400">
                            Expires: {new Date(token.expiry_date).toLocaleDateString()}
                          </p>
                          {token.used_by && (
                            <p className="text-red-400 text-sm">
                              Used by: {token.used_by}
                            </p>
                          )}
                        </div>
                        {!isUsed && (
                          <button
                            onClick={() => handleDeleteUnusedToken(token.id)}
                            className="text-red-500 hover:text-red-400"
                            title="Delete Token"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Users and Tokens Table */}
        <div className="gaming-card border-2 border-blue-500/70 h-[400px] flex flex-col">
          <h2 className="text-2xl font-bold text-red-400 mb-6">Users & Tokens Management</h2>
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-red-500/20">
                  <th className="px-4 py-2 text-red-400">S.No</th>
                  <th className="px-4 py-2 text-red-400">Username</th>
                  <th className="px-4 py-2 text-red-400">Duration</th>
                  <th className="px-4 py-2 text-red-400">Token</th>
                  <th className="px-4 py-2 text-red-400">Expire Date</th>
                  <th className="px-4 py-2 text-red-400">Created At</th>
                  <th className="px-6 py-4 whitespace-nowrap">User Status</th>
                  <th className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Token Expiry</th>
                  <th className="px-4 py-2 text-red-400">Device ID</th>
                  <th className="px-4 py-2 text-red-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => {
                  const userToken = tokens.find(t => t.token === user.token);
                  const isRenewalOpen = activeRenewalUser === user.id;

                  return (
                    <tr key={user.id} className={`border-b border-red-500/10 ${
                      user.token && new Date(user.expiry_date) > new Date() ? 'text-green-500' : ''
                    }`}>
                      <td className="px-4 py-2 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-2 text-gray-400">{user.username}</td>
                      <td className="px-4 py-2 text-gray-400">{userToken?.duration || '-'}</td>
                      <td className="px-4 py-2 text-gray-400">{user.token || '-'}</td>
                      <td className="px-4 py-2 text-gray-400">
                        {userToken?.expiry_date ? (
                          <span className={
                            new Date(userToken.expiry_date) < new Date()
                              ? 'text-red-500'
                              : ''
                          }>
                            {new Date(userToken.expiry_date).toLocaleDateString()}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          !user.token
                            ? 'bg-red-100 text-red-800'
                            : new Date(user.expiry_date) < new Date()
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {!user.token
                            ? 'No Access'
                            : new Date(user.expiry_date) < new Date()
                            ? 'Expired'
                            : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.expiry_date ? (
                          <span className={
                            new Date(user.expiry_date) < new Date()
                              ? 'text-red-500'
                              : ''
                          }>
                            {new Date(user.expiry_date).toLocaleDateString()}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        <span className="font-mono text-xs break-all">
                          {user.device_fingerprint || 'Not registered'}
                        </span>
                      </td>
                      <td className="px-4 py-2 space-x-2 flex items-center">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-500 hover:text-red-400"
                          title="Delete User"
                        >
                          <FaTrash />
                        </button>
                        {user.token && user.token !== '' && (
                          <button
                            onClick={() => handleDeleteUserToken(user.id, user.token)}
                            className="text-red-500 hover:text-red-400"
                            title="Delete Token"
                          >
                            <FaKey />
                          </button>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => setActiveRenewalUser(isRenewalOpen ? null : user.id)}
                            className="text-yellow-500 hover:text-yellow-400"
                            title="Renew Token"
                          >
                            <FaSync />
                          </button>
                          {isRenewalOpen && (
                            <div className="absolute z-10 mt-2 w-48 bg-black/90 rounded-lg shadow-lg p-2 right-0">
                              <select
                                value={renewDuration}
                                onChange={(e) => setRenewDuration(e.target.value)}
                                className="w-full mb-2 bg-black/50 text-gray-300 rounded p-1 border border-gray-700"
                              >
                                <option value="3month">3 Months</option>
                                <option value="6month">6 Months</option>
                                <option value="1year">1 Year</option>
                              </select>
                              <div className="flex justify-between">
                                <button
                                  onClick={() => {
                                    handleRenewToken(user.id, user.token, renewDuration);
                                    setActiveRenewalUser(null);
                                  }}
                                  className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded text-sm"
                                >
                                  Renew
                                </button>
                                <button
                                  onClick={() => setActiveRenewalUser(null)}
                                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

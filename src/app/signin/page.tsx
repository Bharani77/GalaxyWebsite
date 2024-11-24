'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaUserAstronaut, FaLock, FaSignOutAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { signIn, signOut, getSession } from '@/utils/auth';

export default function SignIn() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session?.isLoggedIn) {
      setIsLoggedIn(true);
      setFormData(prev => ({ ...prev, username: session.username }));
      setTokenExpiry(session.tokenExpiry || null);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!formData.username || !formData.password) {
        throw new Error('Please enter both username and password');
      }
      
      console.log('Attempting sign in with:', { username: formData.username });
      const user = await signIn(formData.username, formData.password);
      console.log('Sign in response:', user);
      
      if (user?.isLoggedIn) {
        setIsLoggedIn(true);
        setTokenExpiry(user.tokenExpiry || null);
        toast.success(`Welcome ${formData.username} to Galaxy KickLock Universe!`, {
          duration: 5000,
          icon: '🚀',
          style: {
            background: 'rgba(139, 92, 246, 0.9)',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            backdropFilter: 'blur(8px)',
          },
        });
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.message.includes('token')) {
        toast.error('Token-related error: ' + error.message, {
          duration: 5000,
          icon: '⚠️',
          style: {
            background: 'rgba(239, 68, 68, 0.9)',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            backdropFilter: 'blur(8px)',
          },
        });
      } else {
        toast.error(error.message || 'An error occurred during sign in', {
          duration: 5000,
          icon: '⚠️',
          style: {
            background: 'rgba(239, 68, 68, 0.9)',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            backdropFilter: 'blur(8px)',
          },
        });
      }
      setFormData(prev => ({ ...prev, password: '' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setIsLoggedIn(false);
    setFormData({ username: '', password: '' });
    setTokenExpiry(null);
    toast.success('Signed out successfully');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4">
      {/* Background stars */}
      <div className="fixed inset-0 overflow-hidden">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="star"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {isLoggedIn ? (
        <div className="relative z-10 w-full max-w-4xl mx-auto">
          <div className="flex flex-col items-center space-y-4 p-6 bg-purple-900/20 rounded-2xl backdrop-blur-lg border border-purple-500/30">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                Welcome to Galaxy KickLock Universe
              </h2>
              <p className="text-xl text-purple-300 mb-1">{formData.username}</p>
              {tokenExpiry && (
                <p className="text-sm text-purple-400/80">
                  Access Valid Until: {new Date(tokenExpiry).toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="group relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500/20 to-purple-500/20 hover:from-red-500/30 hover:to-purple-500/30 text-red-400 rounded-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20"
            >
              <FaSignOutAlt className="group-hover:rotate-180 transition-transform duration-300" />
              <span>Sign Out</span>
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>
      ) : (
        <div className="relative z-10 gaming-card max-w-md w-full mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-purple-400 mb-2">Welcome Back</h1>
            <p className="text-gray-400">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-purple-300 mb-2">
                <FaUserAstronaut />
                Username
              </label>
              <input
                type="text"
                className="gaming-input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-purple-300 mb-2">
                <FaLock />
                Password
              </label>
              <input
                type="password"
                className="gaming-input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
                required
              />
            </div>

            <button 
              type="submit" 
              className="gaming-button w-full relative group"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-gray-400">
              Don't have an account?{' '}
              <Link href="/signup" className="text-purple-400 hover:text-purple-300">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .star {
          position: absolute;
          width: 2px;
          height: 2px;
          background: white;
          border-radius: 50%;
          animation: twinkle 3s infinite;
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

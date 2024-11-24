'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaUserAstronaut, FaKey, FaLock } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { signUp } from '@/utils/auth';

export default function SignUp() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    token: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!formData.username || !formData.password || !formData.token) {
        throw new Error('Please fill in all fields');
      }

      // Use the signUp function from auth.ts
      const { user, error } = await signUp(
        formData.username,
        formData.password,
        formData.token
      );

      if (error) throw error;

      toast.success('Sign up successful! You can now sign in.', {
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
      
      router.push('/signin');
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error(error.message || 'Failed to sign up', {
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="gaming-card max-w-md w-full mx-auto space-y-8">
        {/* Loading Animation */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-purple-500/20 rounded-full animate-pulse"></div>
              <div className="w-16 h-16 border-4 border-t-purple-500 rounded-full animate-spin absolute inset-0"></div>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-3xl font-bold text-center text-purple-400 mb-2">
            Create Account
          </h2>
          <p className="text-center text-gray-400">
            Join the Galaxy Kick Lock community
          </p>
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
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_-]+"
              title="Username can only contain letters, numbers, underscores, and hyphens"
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
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-purple-300 mb-2">
              <FaKey />
              Access Token
            </label>
            <input
              type="text"
              className="gaming-input"
              value={formData.token}
              onChange={(e) =>
                setFormData({ ...formData, token: e.target.value })
              }
              required
            />
          </div>

          <button
            type="submit"
            className="w-full gaming-button flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            Create Account
          </button>
        </form>
      </div>

      {/* Background stars */}
      <div className="fixed inset-0 overflow-hidden -z-10">
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
    </main>
  );
}

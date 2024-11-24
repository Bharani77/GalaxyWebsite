'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FaUserAstronaut } from 'react-icons/fa';

export default function Dashboard() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // In a real application, you'd use proper session management
        // This is just a simple example
        if (!userData) {
          router.push('/signin');
        }
      } catch (error) {
        router.push('/signin');
      }
    };

    checkAuth();
  }, [router, userData]);

  if (!userData) {
    return null;
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="gaming-card text-center">
          <div className="mb-8">
            <FaUserAstronaut className="text-6xl text-purple-400 mx-auto mb-4" />
            <h1 className="text-4xl font-bold neon-text mb-2">
              Welcome to GalaxyKick Lock
            </h1>
            <p className="text-gray-400">
              Your gateway to the gaming universe awaits
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-800/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-purple-300 mb-2">
                Account Status
              </h2>
              <p className="text-gray-400">Active</p>
            </div>

            <div className="bg-gray-800/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-purple-300 mb-2">
                Access Level
              </h2>
              <p className="text-gray-400">Premium Member</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black"></div>
      </div>
    </main>
  );
}

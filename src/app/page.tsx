import Link from 'next/link';
import { FaUserAstronaut, FaLock } from 'react-icons/fa';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="gaming-card max-w-md w-full mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold neon-text mb-2">
            Galaxy Kick Lock
          </h1>
          <p className="text-gray-400">
            Enter the gaming universe
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/signin" className="gaming-button w-full flex items-center justify-center gap-2">
            <FaUserAstronaut className="text-xl" />
            Sign In
          </Link>
          
          <Link href="/signup" className="gaming-button w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-blue-500 hover:from-green-500 hover:to-blue-400">
            <FaLock className="text-xl" />
            Sign Up
          </Link>
        </div>
      </div>

      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black"></div>
      </div>
    </main>
  );
}

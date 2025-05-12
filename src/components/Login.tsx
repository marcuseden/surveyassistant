'use client';

import React, { useState } from 'react';
import { signIn, signUp, resetPassword } from '@/lib/auth';

type LoginMode = 'signin' | 'signup' | 'reset';

interface LoginProps {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<LoginMode>('signin');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setDebugInfo('');
    setLoading(true);

    try {
      console.log('Login attempt with:', { email, password: '***' });
      
      if (mode === 'signin') {
        try {
          const result = await signIn(email, password);
          console.log('Sign in result:', result);
          setMessage('Login successful!');
          onSuccess();
        } catch (err) {
          console.error('Sign in error:', err);
          let errorMsg = err instanceof Error ? err.message : 'An error occurred';
          setError(`Login failed: ${errorMsg}`);
          setDebugInfo(JSON.stringify(err, null, 2));
        }
      } else if (mode === 'signup') {
        try {
          const result = await signUp(email, password, name);
          console.log('Sign up result:', result);
          setMessage('Account created! Please check your email to verify your account.');
          setMode('signin');
        } catch (err) {
          console.error('Sign up error:', err);
          let errorMsg = err instanceof Error ? err.message : 'An error occurred';
          setError(`Sign up failed: ${errorMsg}`);
          setDebugInfo(JSON.stringify(err, null, 2));
        }
      } else if (mode === 'reset') {
        try {
          const result = await resetPassword(email);
          console.log('Reset password result:', result);
          setMessage('Password reset link sent to your email.');
        } catch (err) {
          console.error('Reset password error:', err);
          let errorMsg = err instanceof Error ? err.message : 'An error occurred';
          setError(`Password reset failed: ${errorMsg}`);
          setDebugInfo(JSON.stringify(err, null, 2));
        }
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setDebugInfo(JSON.stringify(err, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
          {message}
        </div>
      )}

      {debugInfo && (
        <div className="mb-4 p-3 bg-gray-100 text-gray-700 rounded-md text-xs font-mono overflow-auto max-h-40">
          <details>
            <summary>Debug Information</summary>
            <pre>{debugInfo}</pre>
          </details>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {mode !== 'reset' && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required={mode !== 'reset'}
              minLength={6}
            />
          </div>
        )}

        {mode === 'signup' && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        <div>
          <button
            type="submit"
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={loading}
          >
            {loading
              ? 'Loading...'
              : mode === 'signin'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Reset Password'}
          </button>
        </div>
      </form>

      <div className="mt-4 text-center text-sm">
        {mode === 'signin' ? (
          <>
            <button
              onClick={() => setMode('signup')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Create an account
            </button>
            <span className="mx-2">|</span>
            <button
              onClick={() => setMode('reset')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Forgot password?
            </button>
          </>
        ) : (
          <button
            onClick={() => setMode('signin')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Back to login
          </button>
        )}
      </div>
    </div>
  );
} 
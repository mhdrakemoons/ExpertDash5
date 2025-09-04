import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function AuthPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);

  const toggleMode = () => setIsLoginMode(!isLoginMode);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {isLoginMode ? (
          <LoginForm onToggleMode={toggleMode} />
        ) : (
          <RegisterForm onToggleMode={toggleMode} />
        )}
      </div>
    </div>
  );
}
import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { AuthState, User } from '../types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'REGISTER_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'LOGOUT' }
  | { type: 'TOKEN_REFRESH_SUCCESS'; payload: { user: User; token: string } };

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Start with loading true to check stored auth
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { 
        ...state, 
        isLoading: true, 
        error: null 
      };
    
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
    case 'TOKEN_REFRESH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    
    case 'AUTH_ERROR':
      return { 
        ...state, 
        isLoading: false, 
        error: action.payload,
        user: null,
        token: null,
        isAuthenticated: false,
      };

    case 'CLEAR_ERROR':
      return { 
        ...state, 
        error: null 
      };
    
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    
    default:
      return state;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Enhanced auth state restoration on mount
  useEffect(() => {
    const restoreAuthState = async () => {
      console.log('🔍 Checking for stored authentication...');
      
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('auth_user');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          console.log('📱 Found stored auth for:', user.email);
          
          // Import API service and validate token
          const { apiService } = await import('../services/api');
          
          // Test if the token is still valid
          await apiService.testAuthToken(token);
          
          dispatch({ type: 'TOKEN_REFRESH_SUCCESS', payload: { user, token } });
          console.log('✅ Authentication restored successfully');
          
        } catch (error) {
          console.error('❌ Stored authentication invalid:', error);
          
          // Clear invalid auth data
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          
          dispatch({ 
            type: 'AUTH_ERROR', 
            payload: 'Session expired. Please log in again.' 
          });
        }
      } else {
        console.log('ℹ️ No stored authentication found');
        // Just stop loading, no error
        dispatch({ type: 'LOGOUT' });
      }
    };

    restoreAuthState();
  }, []);

  // Clear error after a delay
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        dispatch({ type: 'CLEAR_ERROR' });
      }, 5000); // Clear error after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [state.error]);

  const login = async (email: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      console.log('🔐 Starting login process...');
      
      // Import here to avoid circular dependency
      const { apiService } = await import('../services/api');
      
      // Validate backend connection first
      await apiService.validateConnection();
      
      const response = await apiService.login(email, password);
      
      const { user, token } = response;
      
      // Store in localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
      console.log('✅ Login successful');
      
    } catch (error) {
      console.error('❌ Login failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'AUTH_ERROR', payload: errorMessage });
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      console.log('📝 Starting registration process...');
      
      // Import here to avoid circular dependency
      const { apiService } = await import('../services/api');
      
      // Validate backend connection first
      await apiService.validateConnection();
      
      const response = await apiService.register(email, password, name, role);
      
      const { user, token } = response;
      
      // Store in localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      
      dispatch({ type: 'REGISTER_SUCCESS', payload: { user, token } });
      console.log('✅ Registration successful');
      
    } catch (error) {
      console.error('❌ Registration failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      dispatch({ type: 'AUTH_ERROR', payload: errorMessage });
      throw error;
    }
  };

  const refreshToken = async () => {
    if (!state.token) {
      throw new Error('No token to refresh');
    }

    try {
      console.log('🔄 Refreshing authentication token...');
      
      const { apiService } = await import('../services/api');
      const response = await apiService.testAuthToken(state.token);
      
      if (response.user) {
        dispatch({ 
          type: 'TOKEN_REFRESH_SUCCESS', 
          payload: { user: response.user, token: state.token } 
        });
        console.log('✅ Token refresh successful');
      }
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      logout();
      throw error;
    }
  };

  const logout = () => {
    console.log('👋 Logging out user...');
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    dispatch({ type: 'LOGOUT' });
    
    console.log('✅ Logout complete');
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      logout,
      refreshToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
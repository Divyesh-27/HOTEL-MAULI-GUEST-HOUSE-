import React, { useState } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { KeyRound, User, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseAvailable } from '@/lib/supabaseBridge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

const LoginMobile: React.FC = () => {
  const setAuthenticated = useMobileStore((s) => s.setAuthenticated);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Try Supabase Auth first
    if (supabase && isSupabaseAvailable() && navigator.onLine) {
      try {
        const email = username.includes('@') ? username : `${username.toLowerCase()}@mauli.com`;
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (!authError) {
          setAuthenticated(true);
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.warn('[LoginMobile] Supabase auth failed:', err.message);
      }
    }

    // Offline fallback — same credentials as desktop
    if (username === 'Abhi695' && password === '758695') {
      setAuthenticated(true);
      setLoading(false);
      return;
    }

    setError('Wrong username or password');
    setLoading(false);
  };

  const isOnline = navigator.onLine;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 safe-area-pt safe-area-pb">
      <motion.div 
        className="w-full max-w-sm"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Hotel branding */}
        <motion.div variants={itemVariants} className="text-center mb-10">
          <div className="w-20 h-20 bg-primary/10 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-sm border border-primary/20">
            <KeyRound className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            HOTEL MAULI GUEST HOUSE
          </h1>
          <p className="text-sm font-bold text-muted-foreground mt-2">
            Welcome Back
          </p>

          {/* Connection status */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-status-available" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Offline Mode</span>
              </>
            )}
          </div>
        </motion.div>

        {/* Login form */}
        <motion.form variants={itemVariants} onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Username / Email</Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-12 h-12 text-base rounded-xl shadow-sm bg-white"
                placeholder="Enter username"
                required
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Password</Label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-12 pr-12 h-12 text-base rounded-xl shadow-sm bg-white"
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 active:scale-90"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="text-xs text-destructive text-center font-medium"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            variants={itemVariants}
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-4 bg-primary text-primary-foreground font-bold text-sm rounded-lg shadow-sm
                       active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? 'Logging in…' : 'Login'}
          </motion.button>
        </motion.form>

        <motion.p variants={itemVariants} className="text-center text-[10px] text-muted-foreground/50 mt-10">
          v1.1.0 Mobile • Hotel Mauli Guest House
        </motion.p>
      </motion.div>
    </div>
  );
};

export default LoginMobile;

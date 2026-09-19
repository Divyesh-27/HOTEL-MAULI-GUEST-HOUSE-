import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { KeyRound, User, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseAvailable } from '@/lib/supabaseBridge';
import { hashPassword, verifyPassword } from '@/utils/crypto';

interface MasterCredential {
  username: string;
  hash: string;
  createdAt: string;
}

const MASTER_CRED_KEY = 'master_auth_credential';

async function getStoredMasterCred(): Promise<MasterCredential | null> {
  try {
    if ((window as any).electronAPI?.get) {
      return await (window as any).electronAPI.get(MASTER_CRED_KEY);
    }
    const raw = localStorage.getItem(MASTER_CRED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[Login] Error fetching master credential:', err);
    return null;
  }
}

async function saveStoredMasterCred(cred: MasterCredential): Promise<boolean> {
  try {
    if ((window as any).electronAPI?.set) {
      await (window as any).electronAPI.set(MASTER_CRED_KEY, cred);
      return true;
    }
    localStorage.setItem(MASTER_CRED_KEY, JSON.stringify(cred));
    return true;
  } catch (err) {
    console.error('[Login] Error saving master credential:', err);
    return false;
  }
}

const Login = () => {
  const { setAuthenticated, setCurrentUser, appUsers, updateAppUser } = useStore();
  
  const [isCheckingMaster, setIsCheckingMaster] = useState(true);
  const [isFirstRunSetup, setIsFirstRunSetup] = useState(false);

  // Regular login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // First-run master setup fields
  const [setupUsername, setSetupUsername] = useState('admin');
  const [setupPassword, setSetupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check if master credential exists in storage on mount
  useEffect(() => {
    let isMounted = true;
    async function checkMaster() {
      const cred = await getStoredMasterCred();
      if (isMounted) {
        if (!cred || !cred.hash) {
          setIsFirstRunSetup(true);
        } else {
          setIsFirstRunSetup(false);
        }
        setIsCheckingMaster(false);
      }
    }
    checkMaster();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleMasterSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedUser = setupUsername.trim();
    if (!trimmedUser) {
      toast.error('Please enter a username for the Master account.');
      return;
    }

    if (setupPassword.length < 6) {
      toast.error('Master password must be at least 6 characters.');
      return;
    }

    if (setupPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Salted PBKDF2 hash
      const saltedHash = await hashPassword(setupPassword);
      const cred: MasterCredential = {
        username: trimmedUser,
        hash: saltedHash,
        createdAt: new Date().toISOString(),
      };

      const saved = await saveStoredMasterCred(cred);
      if (!saved) {
        toast.error('Failed to save master credentials to database.');
        setIsSubmitting(false);
        return;
      }

      setCurrentUser('master');
      setAuthenticated(true);
      toast.success('Master administrator account created successfully!');
    } catch (err: any) {
      console.error('[Login] Setup error:', err);
      toast.error('Setup failed: ' + (err.message || 'Unknown error'));
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1. Try Supabase Auth first if available and online
      if (supabase && isSupabaseAvailable() && navigator.onLine) {
        try {
          const email = username.includes('@') ? username : `${username.toLowerCase()}@mauli.com`;
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (!error) {
            setCurrentUser('master');
            setAuthenticated(true);
            toast.success('Login Successful (Cloud Session)');
            return;
          }
        } catch (err: any) {
          console.warn('[Login] Supabase auth failed/offline:', err.message);
        }
      }

      // 2. Try Local AppUsers (Staff/Managers/Admins) with PBKDF2 & legacy SHA-256 migration
      for (const localUser of appUsers) {
        if (localUser.username.toLowerCase() === username.trim().toLowerCase()) {
          const result = await verifyPassword(password, localUser.passwordHash);
          if (result.valid) {
            if (localUser.status === 'disabled') {
              toast.error('Account is disabled. Contact Admin.');
              setIsSubmitting(false);
              return;
            }

            // Automatic one-time migration for legacy hashes
            if (result.needsRehash && result.newHash && updateAppUser) {
              updateAppUser(localUser.id, {
                ...localUser,
                passwordHash: result.newHash,
                updated_at: new Date().toISOString(),
              });
              console.log(`[Auth Migration] Upgraded password hash for "${localUser.username}" to salted PBKDF2.`);
            }

            setCurrentUser(localUser);
            setAuthenticated(true);
            toast.success(`Welcome, ${localUser.fullName}`);
            return;
          }
        }
      }

      // 3. Verify against stored Master Credential in SQLite state_kv
      const masterCred = await getStoredMasterCred();
      if (masterCred && masterCred.username && masterCred.hash) {
        if (masterCred.username.toLowerCase() === username.trim().toLowerCase()) {
          const result = await verifyPassword(password, masterCred.hash);
          if (result.valid) {
            if (result.needsRehash && result.newHash) {
              await saveStoredMasterCred({
                ...masterCred,
                hash: result.newHash,
              });
            }
            setCurrentUser('master');
            setAuthenticated(true);
            toast.success('Login Successful (Master Admin)');
            return;
          }
        }
      }

      toast.error('Wrong username or password');
    } catch (err: any) {
      console.error('[Login] Login error:', err);
      toast.error('Login error: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingMaster) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // First-run Master Administrator Account Setup Form
  if (isFirstRunSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-8 animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Set Up Master Account</h1>
            <p className="text-xs text-muted-foreground mt-2">
              This is your first time launching the application. Please create your Master Administrator credentials to secure system access.
            </p>
          </div>

          <form onSubmit={handleMasterSetup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="w-4 h-4 text-muted-foreground" /> Master Username
              </label>
              <input
                type="text"
                value={setupUsername}
                onChange={(e) => setSetupUsername(e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="e.g. admin"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-muted-foreground" /> Master Password (min 6 chars)
              </label>
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="Create strong password"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-muted-foreground" /> Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="Confirm password"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-bold rounded-md hover:bg-primary/90 transition-all shadow-md mt-6 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Master Account...' : 'Create Master Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Standard Login Screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-lg p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Please login to access the admin dashboard.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <User className="w-4 h-4" /> Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="Enter username"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-bold rounded-md hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-md mt-6 disabled:opacity-50"
          >
            {isSubmitting ? 'Verifying...' : 'Login to System'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

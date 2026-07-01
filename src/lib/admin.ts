import { createClient } from '@supabase/supabase-js';

// This module is intended to be used only on the server (node) side.
// Prevent accidental client-side imports which would leak service-role keys
// or silently fall back to publishable keys.
if (typeof window !== 'undefined') {
  throw new Error('src/lib/admin.ts is server-only. Call the /api/admin endpoints from the browser instead.');
}

// Types
interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalCalculators: number;
  enabledCalculators: number;
  totalCalculations: number;
  avgLoginCount: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  organization?: string;
  department?: string;
  lastLoginAt?: string;
  loginCount?: number;
}

interface Calculator {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  enabled: boolean;
  isPublic: boolean;
  version: string;
}

function getSupabaseEnv() {
  // Server first: prefer explicit service role + URL env vars
  const serverUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env.VITE_SUPABASE_URL || '');
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

  if (serverKey && serverUrl) {
    return { url: serverUrl, key: serverKey };
  }

  // Fallback for non-server environments (shouldn't happen because we throw earlier)
  const viteEnv = import.meta.env as ImportMetaEnv & {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  };

  return {
    url: viteEnv.VITE_SUPABASE_URL || viteEnv.NEXT_PUBLIC_SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
    key: viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY || viteEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''),
  };
}

// Initialize Supabase client (server-side)
const { url: supabaseUrl, key: supabaseKey } = getSupabaseEnv();
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getAdminStats(): Promise<AdminStats> {
  // Admin-only function: requires server-side service role key
  if (!supabase || !supabaseUrl || !supabaseKey) {
    throw new Error('Admin client not available. Call this function from a server environment with SUPABASE_SERVICE_ROLE_KEY configured.');
  }

  try {
    const { data: users } = await supabase.from('app_users').select('*');
    const { data: activeUsers } = await supabase.from('app_users').select('*').eq('status', 'ACTIVE');
    const { data: calculators } = await supabase.from('calculator_features').select('*');
    const { data: enabledCalcs } = await supabase.from('calculator_features').select('*').eq('enabled', true);
    const { data: calculations } = await supabase.from('calculations').select('*');

    const totalUsers = users?.length || 0;
    const activeCount = activeUsers?.length || 0;
    const totalCalcs = calculators?.length || 0;
    const enabledCount = enabledCalcs?.length || 0;
    const totalCalculations = calculations?.length || 0;

    const loginCounts = (users || []).map((u: any) => u.login_count || 0) || [];
    const avgLoginCount = loginCounts.length > 0
      ? loginCounts.reduce((a: number, b: number) => a + b, 0) / loginCounts.length
      : 0;

    return {
      totalUsers,
      activeUsers: activeCount,
      totalCalculators: totalCalcs,
      enabledCalculators: enabledCount,
      totalCalculations,
      avgLoginCount
    };
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    throw error;
  }
}

export async function getAllUsers(role?: string): Promise<User[]> {
  try {
    let query = supabase.from('app_users').select('*');
    
    if (role && role !== 'ALL') {
      query = query.eq('role', role);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      organization: u.organization,
      department: u.department,
      lastLoginAt: u.last_login_at,
      loginCount: u.login_count
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

export async function suspendUser(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('app_users')
      .update({ status: 'SUSPENDED' })
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
}

export async function activateUser(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('app_users')
      .update({ status: 'ACTIVE' })
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error activating user:', error);
    throw error;
  }
}

export async function getAllCalculators(): Promise<Calculator[]> {
  try {
    const { data, error } = await supabase
      .from('calculator_features')
      .select('*');

    if (error) throw error;

    return (data || []).map((c: any) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      category: c.category,
      enabled: c.enabled,
      isPublic: c.is_public,
      version: c.feature_version
    }));
  } catch (error) {
    console.error('Error fetching calculators:', error);
    throw error;
  }
}

export async function unlockAllCalculators(): Promise<void> {
  try {
    const { error } = await supabase
      .from('calculator_features')
      .update({ enabled: true, is_public: true });

    if (error) throw error;
  } catch (error) {
    console.error('Error unlocking calculators:', error);
    throw error;
  }
}

export async function toggleCalculator(calculatorId: string, enabled: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('calculator_features')
      .update({ enabled })
      .eq('id', calculatorId);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling calculator:', error);
    throw error;
  }
}

export async function toggleCalculatorVisibility(calculatorId: string, isPublic: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('calculator_features')
      .update({ is_public: isPublic })
      .eq('id', calculatorId);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling visibility:', error);
    throw error;
  }
}

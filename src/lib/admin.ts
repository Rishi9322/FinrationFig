import { createClient } from '@supabase/supabase-js';

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

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function getAdminStats(): Promise<AdminStats> {
  try {
    const { data: users, error: usersError } = await supabase
      .from('app_users')
      .select('*');
    
    const { data: activeUsers, error: activeError } = await supabase
      .from('app_users')
      .select('*')
      .eq('status', 'ACTIVE');
    
    const { data: calculators, error: calcError } = await supabase
      .from('calculator_features')
      .select('*');
    
    const { data: enabledCalcs, error: enabledError } = await supabase
      .from('calculator_features')
      .select('*')
      .eq('enabled', true);
    
    const { data: calculations, error: calcHistError } = await supabase
      .from('calculations')
      .select('*');

    const totalUsers = users?.length || 0;
    const activeCount = activeUsers?.length || 0;
    const totalCalcs = calculators?.length || 0;
    const enabledCount = enabledCalcs?.length || 0;
    const totalCalculations = calculations?.length || 0;
    
    const loginCounts = users?.map((u: any) => u.login_count || 0) || [];
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

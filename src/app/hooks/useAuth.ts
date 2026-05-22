import { useEffect, useState } from 'react';
import { fetchCurrentUser, getCurrentUser, type User } from '../../lib/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function validateSession() {
      try {
        const sessionUser = await fetchCurrentUser();
        if (mounted) {
          setUser(sessionUser);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setUser(null);
          setError(err instanceof Error ? err.message : 'Auth check failed');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    validateSession();
    return () => {
      mounted = false;
    };
  }, []);

  return { user, isLoading, error };
}

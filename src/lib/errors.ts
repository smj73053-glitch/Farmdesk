import { supabase } from '@/lib/supabase';

export class AppError extends Error {
  code?: string;
  details?: unknown;
  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

/** Turn Supabase/PostgREST/network errors into user-friendly messages. */
export function toAppError(error: unknown, context = 'Something went wrong'): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    const message = error.message || context;
    const friendly =
      /JWT|token|session/i.test(message) ? 'Your session has expired. Please sign in again.' :
      /Failed to fetch|NetworkError|Load failed/i.test(message) ? 'Network unavailable. Check your connection and try again.' :
      /duplicate key/i.test(message) ? 'This record already exists.' :
      message;
    return new AppError(friendly, undefined, error);
  }
  return new AppError(context);
}

export function errorMessage(error: unknown): string {
  return toAppError(error).message;
}

/** Guard used by services for consistent error surfacing. */
export function throwIfError(error: { message: string; code?: string; details?: string } | null, context: string): void {
  if (error) {
    throw new AppError(`${context}: ${error.message}`, error.code, error.details);
  }
}

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new AppError('Please sign in to continue', 'AUTH_REQUIRED');
  return data.user.id;
}

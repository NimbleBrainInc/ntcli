import { handleLogin } from './login.js';
import { AuthCommandOptions } from '../../types/index.js';

/**
 * Handle user signup via OAuth
 * Note: For OAuth flows, signup and login are typically the same process
 * The OAuth provider (Clerk) handles whether it's a new or existing user
 */
export async function handleSignup(options: AuthCommandOptions = {}): Promise<void> {
  // For OAuth flows, signup is the same as login
  // Clerk will handle user registration if the user doesn't exist
  await handleLogin(options);
}
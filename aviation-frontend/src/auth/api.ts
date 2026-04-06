import { API_BASE } from '../config';
import type { AuthRequest, AuthSuccessResponse } from '../types/auth';

const AUTH_API_BASE = `${API_BASE}/api/auth`;

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string; message?: string };
    return data.detail ?? data.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function postAuth(endpoint: 'register' | 'login' | 'admin/login', payload: AuthRequest): Promise<AuthSuccessResponse> {
  const response = await fetch(`${AUTH_API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as AuthSuccessResponse;
}

export function registerUser(payload: AuthRequest): Promise<AuthSuccessResponse> {
  return postAuth('register', payload);
}

export function loginUser(payload: AuthRequest): Promise<AuthSuccessResponse> {
  return postAuth('login', payload);
}

export function adminLoginUser(payload: AuthRequest): Promise<AuthSuccessResponse> {
  return postAuth('admin/login', payload);
}

export async function fetchAdminMe(token: string): Promise<AuthSuccessResponse['user']> {
  const response = await fetch(`${AUTH_API_BASE}/admin/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as AuthSuccessResponse['user'];
}

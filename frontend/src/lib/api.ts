import { supabase } from './supabase';

export interface Profile { id: string; display_name: string; created_at: string; updated_at: string }

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type JsonRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

function apiUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('API paths must be local absolute paths.');
  }
  return `${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}${path}`;
}

async function getAccessToken(client: NonNullable<typeof supabase>): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error) {
    window.dispatchEvent(new Event('retrest:session-expired'));
    throw new ApiError('Unable to verify your session. Please sign in again.', 401, 'SESSION_UNAVAILABLE');
  }
  if (!data.session) {
    window.dispatchEvent(new Event('retrest:session-expired'));
    throw new ApiError('Please sign in again.', 401, 'SESSION_REQUIRED');
  }
  return data.session.access_token;
}

async function authorizedRequest(path: string, init: RequestInit): Promise<Response> {
  if (!supabase) throw new ApiError('Authentication is unavailable.', 401, 'AUTH_UNAVAILABLE');
  const client = supabase;
  const accessToken = await getAccessToken(client);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    if (cause instanceof TypeError) {
      throw new ApiError('Unable to reach the API. Check your connection and try again.', 0, 'NETWORK_ERROR');
    }
    throw cause;
  }
  if (response.status === 401) {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) {
      throw new ApiError('Your session expired and could not be cleared. Please sign out and back in.', 401, 'SESSION_EXPIRED');
    }
    window.dispatchEvent(new Event('retrest:session-expired'));
  }
  return response;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('The server returned an invalid response.', response.status, 'INVALID_RESPONSE');
  }
}

function readError(body: unknown, status: number): ApiError {
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
    const code = 'code' in body && typeof body.code === 'string' ? body.code : undefined;
    return new ApiError(body.error, status, code);
  }
  return new ApiError(`Request failed (${status}).`, status);
}

export async function jsonRequest<T>(path: string, options: JsonRequestOptions = {}): Promise<T> {
  const headers = new Headers();
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await authorizedRequest(path, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal,
  });
  const payload = await parseJson(response);
  if (!response.ok) throw readError(payload, response.status);
  return payload as T;
}

export async function binaryRequest(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await authorizedRequest(path, { method: 'GET', signal });
  if (!response.ok) throw readError(await parseJson(response), response.status);
  return response.blob();
}

export async function profileRequest(method: 'GET' | 'PATCH' = 'GET', displayName?: string, signal?: AbortSignal): Promise<Profile> {
  const result = await jsonRequest<{ profile?: Profile; error?: string }>('/profile', {
    method,
    ...(signal ? { signal } : {}),
    ...(method === 'PATCH' ? { body: { display_name: displayName ?? '' } } : {}),
  });
  if (!result.profile) throw new ApiError('The server response did not include a profile.', 502, 'INVALID_RESPONSE');
  return result.profile;
}

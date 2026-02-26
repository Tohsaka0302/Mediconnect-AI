/**
 * authFetch — wrapper around fetch that automatically attaches the JWT
 * Bearer token from localStorage to every request.
 *
 * Usage:
 *   import { authFetch } from '../utils/authFetch';
 *   const res = await authFetch('http://localhost:8000/api/analysts');
 */
export const getToken = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        return user?.token || null;
    } catch {
        return null;
    }
};

export const authFetch = (url, options = {}) => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    return fetch(url, { ...options, headers });
};

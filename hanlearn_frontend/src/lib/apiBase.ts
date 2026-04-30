const PRODUCTION_API_FALLBACK = 'https://hanlearn-backend.onrender.com'

function normalizeApiBaseUrl(value: string): string {
	return value.endsWith('/') ? value.slice(0, -1) : value
}

export const API_BASE_URL = import.meta.env.DEV
	? ''
	: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || PRODUCTION_API_FALLBACK)

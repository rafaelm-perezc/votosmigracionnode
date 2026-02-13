// public/js/modules/api.js
const BASE_URL = '/api';

export const API = {
    parseResponse: async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || data.message || `Error HTTP ${res.status}`);
        }
        return data;
    },

    get: async (endpoint) => {
        try {
            const res = await fetch(`${BASE_URL}${endpoint}`);
            return await API.parseResponse(res);
        } catch (e) {
            console.error('API GET Error:', e);
            throw e;
        }
    },

    post: async (endpoint, body) => {
        try {
            const headers = body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
            const options = {
                method: 'POST',
                headers: headers,
                body: body instanceof FormData ? body : JSON.stringify(body)
            };
            const res = await fetch(`${BASE_URL}${endpoint}`, options);
            return await API.parseResponse(res);
        } catch (e) {
            console.error('API POST Error:', e);
            throw e;
        }
    },
    

    put: async (endpoint, body) => {
        try {
            const res = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return await API.parseResponse(res);
        } catch (e) {
            console.error('API PUT Error:', e);
            throw e;
        }
    },

    delete: async (endpoint) => {
        try {
            const res = await fetch(`${BASE_URL}${endpoint}`, { method: 'DELETE' });
            return await API.parseResponse(res);
        } catch (e) {
            throw e;
        }
    }
};
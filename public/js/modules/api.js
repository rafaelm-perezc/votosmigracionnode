// public/js/modules/api.js
const BASE_URL = '/api';

export const API = {
    get: async (endpoint) => {
        try {
            const res = await fetch(`${BASE_URL}${endpoint}`);
            return await res.json();
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
            return await res.json();
        } catch (e) {
            console.error('API POST Error:', e);
            throw e;
        }
    },
    
    delete: async (endpoint) => {
        try {
            const res = await fetch(`${BASE_URL}${endpoint}`, { method: 'DELETE' });
            return await res.json();
        } catch (e) {
            throw e;
        }
    }
};
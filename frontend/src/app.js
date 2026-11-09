// Same-origin path: nginx in the frontend container forwards /api/ to the backend, so the
// UI works in every environment without knowing the backend's host or port.
const API_URL = '/api';

const App = {
    // ==========================================
    // AUTH TOKEN STORAGE MANAGEMENT
    // ==========================================
    getToken() {
        return localStorage.getItem('token');
    },

    setToken(token) {
        localStorage.setItem('token', token);
    },

    clearToken() {
        localStorage.removeItem('token');
    },

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    // ==========================================
    // AUTHENTICATION ENDPOINTS
    // ==========================================
    async register(username, password) {
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Registration failed');
            }
            return await res.json();
        } catch (error) {
            console.error("Registration Engine Error:", error.message);
            throw error;
        }
    },

    async login(username, password) {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Invalid credentials');
            }
            const data = await res.json();
            this.setToken(data.token);
            return data;
        } catch (error) {
            console.error("Login Engine Error:", error.message);
            throw error;
        }
    },

    // ==========================================
    // PROTECTED CRUD RESOURCE ENDPOINTS
    // ==========================================
    async getItems() {
        try {
            const res = await fetch(`${API_URL}/items`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            if (res.status === 401 || res.status === 403) {
                this.clearToken();
                return null;
            }
            if (!res.ok) throw new Error('Failed to fetch items from DB');
            return await res.json();
        } catch (error) {
            console.error("Fetch Items Exception:", error.message);
            throw error;
        }
    },

    async createItem(name) {
        try {
            const res = await fetch(`${API_URL}/items`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error('Failed to create item in DB');
            return await res.json();
        } catch (error) {
            console.error("Create Item Exception:", error.message);
            throw error;
        }
    },

    async deleteItem(id) {
        try {
            const res = await fetch(`${API_URL}/items/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            if (!res.ok) throw new Error('Failed to delete item from DB');
            return await res.json();
        } catch (error) {
            console.error("Delete Item Exception:", error.message);
            throw error;
        }
    }
};

// Lets the unit tests load this file in Node; browsers have no `module` and skip this.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}

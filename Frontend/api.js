// API Service for Parking System
const API_BASE_URL = 'http://localhost:5000/api';

class ParkingAPI {
    constructor() {
        this.token = localStorage.getItem('authToken');
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    // Clear authentication token
    clearToken() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    // Make authenticated request
    async makeRequest(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Authentication endpoints
    async login(username, password) {
        const data = await this.makeRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        this.setToken(data.access_token);
        return data;
    }

    async register(username, password, role = 'customer') {
        const data = await this.makeRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, role })
        });
        
        this.setToken(data.access_token);
        return data;
    }

    async logout() {
        this.clearToken();
    }

    // Parking slots endpoints
    async getParkingSlots(location = null, floor = null, status = null) {
        const params = new URLSearchParams();
        if (location) params.append('location', location);
        if (floor !== null && floor !== undefined && floor !== '') params.append('floor', floor);
        if (status) params.append('status', status);
        const qs = params.toString();
        const endpoint = qs ? `/parking-slots?${qs}` : '/parking-slots';
        return await this.makeRequest(endpoint);
    }

    async updateParkingSlot(slotId, data) {
        return await this.makeRequest(`/parking-slots/${slotId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // Bookings endpoints
    async getBookings() {
        return await this.makeRequest('/bookings');
    }

    async createBooking(bookingData) {
        return await this.makeRequest('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
    }

    async updateBooking(bookingId, data) {
        return await this.makeRequest(`/bookings/${bookingId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteBooking(bookingId) {
        return await this.makeRequest(`/bookings/${bookingId}`, {
            method: 'DELETE'
        });
    }

    // Admin endpoints
    async getAdminStats() {
        return await this.makeRequest('/admin/stats');
    }

    async exportBookings() {
        return await this.makeRequest('/admin/export');
    }

    // Health check
    async healthCheck() {
        return await this.makeRequest('/health');
    }
}

// Create global API instance
const api = new ParkingAPI();

// Export for use in other files
window.ParkingAPI = ParkingAPI;
window.api = api;





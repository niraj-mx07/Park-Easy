// Admin Dashboard JavaScript
let allBookings = [];
let currentUser = null;
let parkingSlots = {};

// Demo credentials
const adminCredentials = {
    username: 'admin',
    password: 'admin123'
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    // Always show login modal first - clear any existing session
    api.clearToken();
    currentUser = null;
    showLoginModal();
    
    setupEventListeners();
    initializeData();
});

// BroadcastChannel to notify customer pages about slot/bookings changes
let updatesChannel = null;
try {
    updatesChannel = new BroadcastChannel('parking-updates');
} catch (e) {
    // ignore if unsupported
}
// Setup Event Listeners
function setupEventListeners() {
    // Admin Login Form
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
}

// Login Functions
function showLoginModal() {
    document.getElementById('adminLoginModal').style.display = 'block';
}

async function handleAdminLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    
    try {
        // Login via API
        const response = await api.login(username, password);
        
        if (response.user.role === 'admin') {
            currentUser = response.user;
            showAdminDashboard();
            showMessage('Welcome Admin!', 'success');
        } else {
            showMessage('Admin access required', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Invalid credentials. Please try again.', 'error');
    }
}

function showAdminDashboard() {
    document.getElementById('adminLoginModal').style.display = 'none';
    loadAdminData();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('adminUser');
    showLoginModal();
    showMessage('Logged out successfully', 'success');
}

// Admin Functions
async function loadAdminData() {
    try {
        await Promise.all([
            loadBookings(),
            loadParkingSlots(),
            updateAdminStats()
        ]);
        populateBookingsTable();
        renderBookedByLocation();
        loadPaymentDetails();
    } catch (error) {
        console.error('Error loading admin data:', error);
        showMessage('Error loading data', 'error');
    }
}

async function loadBookings() {
    try {
        allBookings = await api.getBookings();
    } catch (error) {
        console.error('Error loading bookings:', error);
        allBookings = [];
    }
}

function renderBookedByLocation() {
    const tbody = document.getElementById('bookedByLocationBody');
    if (!tbody) return;

    const selected = (document.getElementById('adminLocationFilter')?.value || '').trim();
    const locations = ['CityMall', 'TechPark', 'CentralOffice', 'Airport', 'Stadium'];

    const grouped = {};
    locations.forEach(loc => grouped[loc] = { active: 0, total: 0 });

    allBookings.forEach(b => {
        const loc = b.location || 'CityMall';
        if (!(loc in grouped)) grouped[loc] = { active: 0, total: 0 };
        grouped[loc].total += 1;
        if (b.status === 'active') grouped[loc].active += 1;
    });

    const rows = [];
    Object.keys(grouped)
        .filter(loc => !selected || loc === selected)
        .forEach(loc => {
            rows.push(`<tr><td>${loc}</td><td>${grouped[loc].active}</td><td>${grouped[loc].total}</td></tr>`);
        });

    tbody.innerHTML = rows.join('') || '<tr><td colspan="3" style="text-align:center;padding:16px;">No data</td></tr>';
}

async function loadParkingSlots() {
    try {
        const slots = await api.getParkingSlots();
        parkingSlots = {};
        slots.forEach(slot => {
            parkingSlots[slot.slot_id] = {
                status: slot.status,
                bookedBy: slot.booked_by
            };
        });
    } catch (error) {
        console.error('Error loading parking slots:', error);
    }
}

async function updateAdminStats() {
    try {
        const stats = await api.getAdminStats();
        document.getElementById('totalBookings').textContent = stats.total_bookings;
        document.getElementById('totalRevenue').textContent = `₹${stats.total_revenue}`;
        document.getElementById('activeBookings').textContent = stats.active_bookings;
        document.getElementById('availableSlots').textContent = stats.available_slots;
    } catch (error) {
        console.error('Error loading stats:', error);
        // Fallback to local data
        const totalBookings = allBookings.length;
        const totalRevenue = allBookings.reduce((sum, booking) => sum + booking.amount, 0);
        const activeBookings = allBookings.filter(booking => booking.status === 'active').length;
        const availableSlots = Object.values(parkingSlots).filter(slot => slot.status === 'available').length;
        
        document.getElementById('totalBookings').textContent = totalBookings;
        document.getElementById('totalRevenue').textContent = `₹${totalRevenue}`;
        document.getElementById('activeBookings').textContent = activeBookings;
        document.getElementById('availableSlots').textContent = availableSlots;
    }
}

function populateBookingsTable() {
    const tbody = document.getElementById('bookingsTableBody');
    tbody.innerHTML = '';
    
    if (allBookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No bookings found</td></tr>';
        return;
    }
    
    allBookings.forEach(booking => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${booking._id}</td>
            <td>${booking.customer_name}</td>
            <td>${booking.vehicle_number}</td>
            <td>${booking.slot}</td>
            <td>${booking.location || ''}</td>
            <td>${booking.date} ${booking.time}</td>
            <td>${booking.duration} hour${booking.duration > 1 ? 's' : ''}</td>
            <td>₹${booking.amount}</td>
            <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
            <td>
                <button class="btn-action btn-edit" onclick="editBooking('${booking._id}')">Edit</button>
                <button class="btn-action btn-delete" onclick="deleteBooking('${booking._id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function refreshAdminData() {
    await loadAdminData();
    showMessage('Admin data refreshed!', 'success');
}

async function editBooking(bookingId) {
    try {
        const booking = allBookings.find(b => b._id === bookingId);
        if (booking) {
            // Toggle status
            const newStatus = booking.status === 'active' ? 'completed' : 'active';
            
            await api.updateBooking(bookingId, { status: newStatus });
            
            // Update local data
            booking.status = newStatus;
            
            // Update parking slot status
            if (newStatus === 'active') {
                parkingSlots[booking.slot].status = 'booked';
                parkingSlots[booking.slot].bookedBy = booking.customer_name;
            } else {
                parkingSlots[booking.slot].status = 'available';
                parkingSlots[booking.slot].bookedBy = null;
            }
            
            populateBookingsTable();
            updateAdminStats();
            loadPaymentDetails();
            // Notify other tabs (customer view) to refresh availability
            try { updatesChannel && updatesChannel.postMessage({ type: 'slots-updated' }); } catch(e){}
            showMessage(`Booking ${bookingId} status updated`, 'success');
        }
    } catch (error) {
        console.error('Error updating booking:', error);
        showMessage('Error updating booking', 'error');
    }
}

async function deleteBooking(bookingId) {
    if (confirm('Are you sure you want to delete this booking?')) {
        try {
            await api.deleteBooking(bookingId);
            
            // Remove from local data
            allBookings = allBookings.filter(b => b._id !== bookingId);
            
            populateBookingsTable();
            updateAdminStats();
            loadPaymentDetails();
            // Notify other tabs (customer view) to refresh availability
            try { updatesChannel && updatesChannel.postMessage({ type: 'slots-updated' }); } catch(e){}
            showMessage(`Booking ${bookingId} deleted successfully`, 'success');
        } catch (error) {
            console.error('Error deleting booking:', error);
            showMessage('Error deleting booking', 'error');
        }
    }
}

async function exportToExcel() {
    try {
        const bookings = await api.exportBookings();
        
        if (bookings.length === 0) {
            showMessage('No data to export', 'error');
            return;
        }
        
        // Create CSV content
        let csvContent = "ID,Customer Name,Vehicle Number,Slot,Date,Time,Duration (hours),Amount,Status\n";
        
        bookings.forEach(booking => {
            csvContent += `${booking._id},${booking.customer_name},${booking.vehicle_number},${booking.slot},${booking.date},${booking.time},${booking.duration},${booking.amount},${booking.status}\n`;
        });
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `parking_bookings_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showMessage('Data exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showMessage('Error exporting data', 'error');
    }
}

function filterBookings() {
    const statusFilter = document.getElementById('statusFilter').value;
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    
    let filteredBookings = allBookings;
    
    if (statusFilter) {
        filteredBookings = filteredBookings.filter(booking => booking.status === statusFilter);
    }
    
    if (searchInput) {
        filteredBookings = filteredBookings.filter(booking => 
            booking.name.toLowerCase().includes(searchInput) ||
            booking.vehicle.toLowerCase().includes(searchInput) ||
            booking.slot.toLowerCase().includes(searchInput)
        );
    }
    
    displayFilteredBookings(filteredBookings);
}

function searchBookings() {
    filterBookings();
}

function displayFilteredBookings(bookings) {
    const tbody = document.getElementById('bookingsTableBody');
    tbody.innerHTML = '';
    
    if (bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No bookings found matching your criteria</td></tr>';
        return;
    }
    
    bookings.forEach(booking => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${booking.id}</td>
            <td>${booking.name}</td>
            <td>${booking.vehicle}</td>
            <td>${booking.slot}</td>
            <td>${booking.date} ${booking.time}</td>
            <td>${booking.duration} hour${booking.duration > 1 ? 's' : ''}</td>
            <td>₹${booking.amount}</td>
            <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
            <td>
                <button class="btn-action btn-edit" onclick="editBooking(${booking.id})">Edit</button>
                <button class="btn-action btn-delete" onclick="deleteBooking(${booking.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// viewParkingStatus removed per request

// Initialize data
function initializeData() {
    // Data will be loaded via API calls
    allBookings = [];
    parkingSlots = {};
}

// Payment Details Functions
async function loadPaymentDetails() {
    try {
        const locationFilter = document.getElementById('paymentLocationFilter')?.value || '';
        const statusFilter = document.getElementById('paymentStatusFilter')?.value || '';
        
        // Filter bookings based on location and status
        let filteredBookings = allBookings;
        
        if (locationFilter) {
            filteredBookings = filteredBookings.filter(b => b.location === locationFilter);
        }
        
        if (statusFilter) {
            filteredBookings = filteredBookings.filter(b => b.status === statusFilter);
        }
        
        // Calculate payment statistics
        const totalRevenue = filteredBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
        const totalTransactions = filteredBookings.length;
        const completedPayments = filteredBookings.filter(b => b.status === 'completed').length;
        const pendingPayments = filteredBookings.filter(b => b.status === 'active').length;
        
        // Update summary cards
        document.getElementById('totalPaymentRevenue').textContent = `₹${totalRevenue}`;
        document.getElementById('totalTransactions').textContent = totalTransactions;
        document.getElementById('completedPayments').textContent = completedPayments;
        document.getElementById('pendingPayments').textContent = pendingPayments;
        
        // Populate payment details table
        populatePaymentDetailsTable(filteredBookings);
    } catch (error) {
        console.error('Error loading payment details:', error);
        showMessage('Error loading payment details', 'error');
    }
}

function populatePaymentDetailsTable(bookings) {
    const tbody = document.getElementById('paymentDetailsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No payment records found</td></tr>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedBookings = [...bookings].sort((a, b) => {
        const dateA = new Date(a.created_at || `${a.date} ${a.time}`);
        const dateB = new Date(b.created_at || `${b.date} ${b.time}`);
        return dateB - dateA;
    });
    
    sortedBookings.forEach(booking => {
        const row = document.createElement('tr');
        const paymentDate = booking.created_at 
            ? new Date(booking.created_at).toLocaleString('en-IN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            })
            : 'N/A';
        
        row.innerHTML = `
            <td>${booking._id.substring(0, 8)}...</td>
            <td>${booking.customer_name}</td>
            <td>${booking.vehicle_number}</td>
            <td>${booking.slot}</td>
            <td>${booking.location || 'N/A'}</td>
            <td>${booking.date} ${booking.time}</td>
            <td>₹${booking.amount || 0}</td>
            <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
            <td>${paymentDate}</td>
        `;
        tbody.appendChild(row);
    });
}

// Utility Functions
function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
    messageDiv.innerHTML = message;
    
    // Insert at the top of the page
    document.body.insertBefore(messageDiv, document.body.firstChild);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

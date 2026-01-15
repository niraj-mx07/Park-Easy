// Global Variables
let currentSection = 'home';
let bookingData = {};
let parkingSlots = {};
let selectedFloor = 1;
let selectedLocation = 'CityMall';
let currentCustomer = null;
let myBookings = [];
let filteredBookings = [];

// Cross-tab updates from Admin using BroadcastChannel
let updatesChannel = null;
try {
    updatesChannel = new BroadcastChannel('parking-updates');
    updatesChannel.onmessage = async function() {
        await initializeParkingSlots();
    };
} catch (e) {
    // BroadcastChannel not supported; no-op
}

// Initialize parking slots from API
async function initializeParkingSlots() {
    try {
        const slots = await api.getParkingSlots(selectedLocation, selectedFloor, null);
        parkingSlots = {};
        slots.forEach(slot => {
            parkingSlots[slot.slot_id] = {
                status: slot.status,
                bookedBy: slot.booked_by,
                floor: slot.floor,
                location: slot.location
            };
        });
        renderSlotsGrid();
        updateParkingGrid();
        updateAvailabilityStats();
        updateSlotDropdown();
    } catch (error) {
        console.error('Error loading parking slots:', error);
        // Fallback to default slots if API fails
        const rows = ['A','B','C','D'];
        const nums = ['1','2','3'];
        parkingSlots = {};
        rows.forEach(row => {
            nums.forEach(num => {
                const id = `F${selectedFloor}-${row}${num}`;
                parkingSlots[id] = { status: 'available', bookedBy: null, floor: selectedFloor, location: selectedLocation };
            });
        });
        renderSlotsGrid();
    }
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    initializeParkingSlots();
    setMinDate();
    checkCustomerAuth();
});

// Initialize Application
function initializeApp() {
    showSection('home');
    updateNavigation();
}

// Setup Event Listeners
function setupEventListeners() {
    // Navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            updateNavigation();
            
            // Close mobile menu
            const navMenu = document.querySelector('.nav-menu');
            navMenu.classList.remove('active');
        });
    });

    // Mobile Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    hamburger.addEventListener('click', function() {
        navMenu.classList.toggle('active');
    });

    // Booking Form
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', handleBookingSubmit);
        
        // Duration change listener for price calculation
        const durationSelect = document.getElementById('duration');
        durationSelect.addEventListener('change', calculateTotal);

        // Location/Floor change affects slot list
        const locationSelect = document.getElementById('location');
        if (locationSelect) {
            locationSelect.addEventListener('change', async function() {
                selectedLocation = this.value;
                await initializeParkingSlots();
            });
        }

        const floorSelect = document.getElementById('floor');
        if (floorSelect) {
            floorSelect.addEventListener('change', async function() {
                selectedFloor = parseInt(this.value, 10);
                await initializeParkingSlots();
            });
        }
    }

    // Payment Method Tabs
    const methodTabs = document.querySelectorAll('.method-tab');
    methodTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            switchPaymentMethod(this.getAttribute('data-method'));
        });
    });

    // Card Number Formatting
    const cardNumberInput = document.getElementById('cardNumber');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', formatCardNumber);
    }

    // Expiry Date Formatting
    const expiryInput = document.getElementById('expiry');
    if (expiryInput) {
        expiryInput.addEventListener('input', formatExpiryDate);
    }

    // Contact Form
    const contactForm = document.querySelector('#contact form');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactSubmit);
    }

    // Customer Login Form
    const customerLoginForm = document.getElementById('customerLoginForm');
    if (customerLoginForm) {
        customerLoginForm.addEventListener('submit', handleCustomerLogin);
    }


    // Availability filters
    const availabilityLocation = document.getElementById('availabilityLocation');
    const availabilityFloor = document.getElementById('availabilityFloor');
    if (availabilityLocation) {
        availabilityLocation.addEventListener('change', async function() {
            selectedLocation = this.value;
            await initializeParkingSlots();
        });
    }
    if (availabilityFloor) {
        availabilityFloor.addEventListener('change', async function() {
            selectedFloor = parseInt(this.value, 10);
            await initializeParkingSlots();
        });
    }

    // Extend booking form
    const extendBookingForm = document.getElementById('extendBookingForm');
    if (extendBookingForm) {
        extendBookingForm.addEventListener('submit', handleExtendBooking);
        const extendDuration = document.getElementById('extendDuration');
        if (extendDuration) {
            extendDuration.addEventListener('change', calculateExtendAmount);
        }
    }
}

// Navigation Functions
function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionName;
    }

    // Update navigation
    updateNavigation();

    // Load bookings when My Bookings section is shown
    if (sectionName === 'mybookings') {
        loadMyBookings();
    }
}

function updateNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === currentSection) {
            link.classList.add('active');
        }
    });
}

// Booking Functions
function handleBookingSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const bookingInfo = {
        name: formData.get('name'),
        vehicle: formData.get('vehicle'),
        date: formData.get('date'),
        time: formData.get('time'),
        duration: formData.get('duration'),
        slot: formData.get('slot'),
        location: selectedLocation
    };

    // Validate form
    if (!validateBookingForm(bookingInfo)) {
        return;
    }

    // Check if slot is available
    if (parkingSlots[bookingInfo.slot] && parkingSlots[bookingInfo.slot].status === 'booked') {
        showMessage('Selected slot is no longer available. Please choose another slot.', 'error');
        updateSlotDropdown();
        return;
    }

    // Store booking data
    bookingData = bookingInfo;
    
    // Update payment section
    updatePaymentSummary(bookingInfo);
    
    // Show success message and redirect to payment
    showMessage('Booking details saved! Redirecting to payment...', 'success');
    
    setTimeout(() => {
        showSection('payment');
    }, 2000);
}

function validateBookingForm(data) {
    const errors = [];
    
    if (!data.name.trim()) errors.push('Name is required');
    if (!data.vehicle.trim()) errors.push('Vehicle number is required');
    if (!data.date) errors.push('Date is required');
    if (!data.time) errors.push('Time is required');
    if (!data.duration) errors.push('Duration is required');
    if (!data.slot) errors.push('Parking slot is required');
    
    // Check if date is not in the past
    const selectedDate = new Date(data.date + 'T' + data.time);
    const now = new Date();
    if (selectedDate < now) {
        errors.push('Please select a future date and time');
    }

    if (errors.length > 0) {
        showMessage(errors.join('<br>'), 'error');
        return false;
    }
    
    return true;
}

function calculateTotal() {
    const durationSelect = document.getElementById('duration');
    const totalAmountSpan = document.getElementById('totalAmount');
    
    const duration = durationSelect.value;
    let amount = 0;
    
    switch(duration) {
        case '1': amount = 20; break;
        case '2': amount = 35; break;
        case '4': amount = 60; break;
        case '8': amount = 100; break;
        case '24': amount = 200; break;
        default: amount = 0;
    }
    
    totalAmountSpan.textContent = amount;
}

function updateSlotDropdown() {
    const slotSelect = document.getElementById('slot');
    slotSelect.innerHTML = '<option value="">Select Slot</option>';
    
    Object.keys(parkingSlots)
        .filter(slotId => parkingSlots[slotId].status === 'available')
        .sort()
        .forEach(slotId => {
            const option = document.createElement('option');
            option.value = slotId;
            option.textContent = `Slot ${slotId}`;
            slotSelect.appendChild(option);
        });
}

function selectSlot(slotId) {
    if (parkingSlots[slotId] && parkingSlots[slotId].status === 'available') {
        // Remove previous selection
        const previouslySelected = document.querySelector('.slot.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }
        
        // Add selection to clicked slot
        const slotElement = document.querySelector(`[data-slot="${slotId}"]`);
        slotElement.classList.add('selected');
        
        // Update form if on booking page
        const slotSelect = document.getElementById('slot');
        if (slotSelect) {
            slotSelect.value = slotId;
        }
        
        showMessage(`Slot ${slotId} selected`, 'success');
        setTimeout(() => {
            const successMsg = document.querySelector('.success-message');
            if (successMsg) successMsg.remove();
        }, 2000);
    }
}

// Availability Functions
function updateAvailabilityStats() {
    const totalSlots = Object.keys(parkingSlots).length;
    const availableSlots = Object.values(parkingSlots).filter(slot => slot.status === 'available').length;
    const bookedSlots = totalSlots - availableSlots;
    
    document.getElementById('totalSlots').textContent = totalSlots;
    document.getElementById('availableSlots').textContent = availableSlots;
    document.getElementById('bookedSlots').textContent = bookedSlots;
}

function refreshAvailability() {
    const button = document.querySelector('button[onclick="refreshAvailability()"]');
    const icon = button.querySelector('i');
    
    // Add spinning animation
    icon.style.animation = 'spin 1s linear infinite';
    
    // Re-fetch latest availability from API for current location/floor
    (async () => {
        try {
            const slots = await api.getParkingSlots(selectedLocation, selectedFloor, null);
            parkingSlots = {};
            slots.forEach(slot => {
                parkingSlots[slot.slot_id] = {
                    status: slot.status,
                    bookedBy: slot.booked_by,
                    floor: slot.floor,
                    location: slot.location
                };
            });
            renderSlotsGrid();
            updateParkingGrid();
            updateAvailabilityStats();
            updateSlotDropdown();
            showMessage('Availability updated!', 'success');
        } catch (e) {
            console.error('Refresh availability failed:', e);
            showMessage('Failed to refresh availability', 'error');
        } finally {
            // Remove spinning animation
            icon.style.animation = '';
            setTimeout(() => {
                const successMsg = document.querySelector('.success-message');
                if (successMsg) successMsg.remove();
            }, 2000);
        }
    })();
}

function updateParkingGrid() {
    Object.keys(parkingSlots).forEach(slotId => {
        const slotElement = document.querySelector(`[data-slot="${slotId}"]`);
        if (slotElement) {
            slotElement.className = `slot ${parkingSlots[slotId].status}`;
        }
    });
}

function renderSlotsGrid() {
    const grid = document.getElementById('slotsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    // Render grouped by zone A-D, numbers 1-3
    const zones = ['A','B','C','D'];
    const nums = ['1','2','3'];

    zones.forEach(zone => {
        nums.forEach(num => {
            const id = `F${selectedFloor}-${zone}${num}`;
            const status = parkingSlots[id]?.status || 'available';
            const div = document.createElement('div');
            div.className = `slot ${status}`;
            div.setAttribute('data-slot', id);
            div.textContent = `${zone}${num}`;
            div.addEventListener('click', function() {
                selectSlot(id);
            });
            grid.appendChild(div);
        });
    });
}

// Payment Functions
function updatePaymentSummary(data) {
    document.getElementById('paymentSlot').textContent = data.slot;
    document.getElementById('paymentDuration').textContent = `${data.duration} hour${data.duration > 1 ? 's' : ''}`;
    document.getElementById('paymentDate').textContent = data.date;
    
    let amount = 0;
    switch(data.duration) {
        case '1': amount = 20; break;
        case '2': amount = 35; break;
        case '4': amount = 60; break;
        case '8': amount = 100; break;
        case '24': amount = 200; break;
    }
    
    document.getElementById('paymentTotal').textContent = `₹${amount}`;
}

function switchPaymentMethod(method) {
    // Update tabs
    const tabs = document.querySelectorAll('.method-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-method') === method) {
            tab.classList.add('active');
        }
    });
    
    // Update forms
    const forms = document.querySelectorAll('.payment-form');
    forms.forEach(form => {
        form.classList.remove('active');
        if (form.id === method + 'Form') {
            form.classList.add('active');
        }
    });
}

function formatCardNumber(e) {
    let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    if (formattedValue.length > 19) formattedValue = formattedValue.substring(0, 19);
    e.target.value = formattedValue;
}

function formatExpiryDate(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    e.target.value = value;
}

function processPayment() {
    const activeMethod = document.querySelector('.method-tab.active').getAttribute('data-method');
    
    // Basic validation
    let isValid = true;
    let errors = [];
    
    if (activeMethod === 'card') {
        const cardNumber = document.getElementById('cardNumber').value;
        const expiry = document.getElementById('expiry').value;
        const cvv = document.getElementById('cvv').value;
        const cardName = document.getElementById('cardName').value;
        
        if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
            errors.push('Please enter a valid card number');
            isValid = false;
        }
        if (!expiry || expiry.length < 5) {
            errors.push('Please enter a valid expiry date');
            isValid = false;
        }
        if (!cvv || cvv.length < 3) {
            errors.push('Please enter a valid CVV');
            isValid = false;
        }
        if (!cardName.trim()) {
            errors.push('Please enter cardholder name');
            isValid = false;
        }
    } else if (activeMethod === 'upi') {
        const upiId = document.getElementById('upiId').value;
        if (!upiId.trim() || !upiId.includes('@')) {
            errors.push('Please enter a valid UPI ID');
            isValid = false;
        }
    }
    
    if (!isValid) {
        showMessage(errors.join('<br>'), 'error');
        return;
    }
    
    // Simulate payment processing
    const payButton = document.querySelector('button[onclick="processPayment()"]');
    const originalText = payButton.innerHTML;
    
    payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    payButton.disabled = true;
    
    setTimeout(async () => {
        try {
            // Calculate amount
            let amount = 0;
            switch(bookingData.duration) {
                case '1': amount = 20; break;
                case '2': amount = 35; break;
                case '4': amount = 60; break;
                case '8': amount = 100; break;
                case '24': amount = 200; break;
            }

            // Ensure we are authenticated
            if (!api.token) {
                // If user is not logged in, show login modal
                if (!currentCustomer) {
                    showMessage('Please login to complete your booking', 'error');
                    showCustomerLogin();
                    payButton.innerHTML = originalText;
                    payButton.disabled = false;
                    return;
                }
                // Try to login with stored credentials
                try {
                    const storedCustomer = localStorage.getItem('customerName');
                    if (storedCustomer) {
                        await api.login(storedCustomer, 'customer123');
                    } else {
                        throw new Error('Not authenticated');
                    }
                } catch (authErr) {
                    showMessage('Authentication failed. Please login again.', 'error');
                    showCustomerLogin();
                    payButton.innerHTML = originalText;
                    payButton.disabled = false;
                    return;
                }
            }
            
            // Create booking via API
            const bookingData_api = {
                name: bookingData.name,
                vehicle: bookingData.vehicle,
                slot: bookingData.slot,
                location: bookingData.location || selectedLocation,
                date: bookingData.date,
                time: bookingData.time,
                duration: parseInt(bookingData.duration),
                amount: amount
            };
            
            const newBooking = await api.createBooking(bookingData_api);
            
            // Update local parking slots
            // Only optimistically update if the current view matches the booking location
            if (bookingData.slot && selectedLocation === bookingData_api.location && parkingSlots[bookingData.slot]) {
                parkingSlots[bookingData.slot].status = 'booked';
                parkingSlots[bookingData.slot].bookedBy = bookingData.name;
            }
            
            // Update availability
            // Switch availability controls to the booked location/floor and re-fetch
            const availabilityLocation = document.getElementById('availabilityLocation');
            const availabilityFloor = document.getElementById('availabilityFloor');
            if (availabilityLocation) {
                selectedLocation = bookingData_api.location;
                availabilityLocation.value = selectedLocation;
            }
            if (availabilityFloor) {
                // Parse floor from slot id like F1-A1
                const floorFromSlot = /^F(\d+)-/.exec(bookingData.slot)?.[1];
                if (floorFromSlot) {
                    selectedFloor = parseInt(floorFromSlot, 10);
                    availabilityFloor.value = String(selectedFloor);
                }
            }
            await initializeParkingSlots();
            
            // Show success message
            showMessage('Payment successful! Your parking slot has been booked.', 'success');
            
            // Reset button
            payButton.innerHTML = originalText;
            payButton.disabled = false;
            
            // Redirect to home after success
            setTimeout(() => {
                showSection('home');
            }, 3000);
            
        } catch (error) {
            console.error('Booking error:', error);
            showMessage('Booking failed: ' + error.message, 'error');
            
            // Reset button
            payButton.innerHTML = originalText;
            payButton.disabled = false;
        }
    }, 2000);
}

// Contact Form Handler
function handleContactSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const name = formData.get('name') || e.target.querySelector('input[placeholder="Your Name"]').value;
    const email = formData.get('email') || e.target.querySelector('input[placeholder="Your Email"]').value;
    const message = formData.get('message') || e.target.querySelector('textarea').value;
    
    if (!name.trim() || !email.trim() || !message.trim()) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    // Simulate form submission
    showMessage('Thank you for your message! We will get back to you soon.', 'success');
    e.target.reset();
}

// Customer Authentication Functions
function checkCustomerAuth() {
    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
        // Try to get user info from token (simplified - in production, decode JWT)
        // For now, we'll check if there's a stored customer name
        const storedCustomer = localStorage.getItem('customerName');
        if (storedCustomer) {
            currentCustomer = { username: storedCustomer };
            updateCustomerUI();
        }
    }
}

function showCustomerLogin() {
    const modal = document.getElementById('customerLoginModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function hideCustomerLogin() {
    const modal = document.getElementById('customerLoginModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleCustomerLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    
    try {
        // Login via API
        const response = await api.login(username, password);
        
        if (response.user.role === 'customer') {
            currentCustomer = response.user;
            localStorage.setItem('customerName', response.user.username);
            updateCustomerUI();
            hideCustomerLogin();
            showMessage('Welcome! You are now logged in.', 'success');
        } else {
            showMessage('Customer access required', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Invalid credentials. Please try again.', 'error');
    }
}

function handleCustomerLogout() {
    currentCustomer = null;
    localStorage.removeItem('customerName');
    api.logout();
    updateCustomerUI();
    showMessage('Logged out successfully', 'success');
}

function updateCustomerUI() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const customerWelcome = document.getElementById('customerWelcome');
    const customerName = document.getElementById('customerName');
    
    if (currentCustomer) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (customerWelcome) customerWelcome.style.display = 'inline';
        if (customerName) customerName.textContent = currentCustomer.username;
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (customerWelcome) customerWelcome.style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const customerModal = document.getElementById('customerLoginModal');
    const extendModal = document.getElementById('extendBookingModal');
    const receiptModal = document.getElementById('receiptModal');
    if (event.target === customerModal) {
        hideCustomerLogin();
    }
    if (event.target === extendModal) {
        closeExtendModal();
    }
    if (event.target === receiptModal) {
        closeReceiptModal();
    }
}

// Booking Management Functions
async function loadMyBookings() {
    const loginPrompt = document.getElementById('bookingsLoginPrompt');
    const bookingsList = document.getElementById('myBookingsList');
    
    if (!currentCustomer || !api.token) {
        if (loginPrompt) loginPrompt.style.display = 'block';
        if (bookingsList) bookingsList.innerHTML = '';
        return;
    }
    
    if (loginPrompt) loginPrompt.style.display = 'none';
    
    try {
        myBookings = await api.getBookings();
        filteredBookings = [...myBookings];
        displayMyBookings();
        updateBookingStats();
    } catch (error) {
        console.error('Error loading bookings:', error);
        if (error.message.includes('401') || error.message.includes('token')) {
            showMessage('Session expired. Please login again.', 'error');
            currentCustomer = null;
            updateCustomerUI();
            if (loginPrompt) loginPrompt.style.display = 'block';
        } else {
            showMessage('Error loading bookings. Please try again.', 'error');
        }
    }
}

function displayMyBookings() {
    const bookingsList = document.getElementById('myBookingsList');
    if (!bookingsList) return;
    
    if (filteredBookings.length === 0) {
        bookingsList.innerHTML = '<div class="no-bookings"><i class="fas fa-calendar-times"></i><p>No bookings found</p></div>';
        return;
    }
    
    // Sort bookings: active first, then by date (newest first)
    const sortedBookings = [...filteredBookings].sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        const dateA = new Date(a.created_at || `${a.date} ${a.time}`);
        const dateB = new Date(b.created_at || `${b.date} ${b.time}`);
        return dateB - dateA;
    });
    
    bookingsList.innerHTML = sortedBookings.map(booking => {
        const bookingDate = new Date(`${booking.date} ${booking.time}`);
        const endDate = new Date(bookingDate.getTime() + booking.duration * 60 * 60 * 1000);
        const isActive = booking.status === 'active';
        const isPast = endDate < new Date();
        const canExtend = isActive && !isPast;
        const canCancel = isActive && !isPast;
        
        return `
            <div class="booking-card ${booking.status}">
                <div class="booking-card-header">
                    <div class="booking-id">
                        <i class="fas fa-receipt"></i>
                        <span>Booking ID: ${booking._id.substring(0, 8)}...</span>
                    </div>
                    <span class="status-badge status-${booking.status}">${booking.status}</span>
                </div>
                <div class="booking-card-body">
                    <div class="booking-info-row">
                        <div class="booking-info-item">
                            <i class="fas fa-car"></i>
                            <div>
                                <span class="info-label">Vehicle</span>
                                <span class="info-value">${booking.vehicle_number}</span>
                            </div>
                        </div>
                        <div class="booking-info-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <div>
                                <span class="info-label">Location</span>
                                <span class="info-value">${booking.location || 'N/A'}</span>
                            </div>
                        </div>
                        <div class="booking-info-item">
                            <i class="fas fa-parking"></i>
                            <div>
                                <span class="info-label">Slot</span>
                                <span class="info-value">${booking.slot}</span>
                            </div>
                        </div>
                    </div>
                    <div class="booking-info-row">
                        <div class="booking-info-item">
                            <i class="fas fa-calendar"></i>
                            <div>
                                <span class="info-label">Date</span>
                                <span class="info-value">${booking.date}</span>
                            </div>
                        </div>
                        <div class="booking-info-item">
                            <i class="fas fa-clock"></i>
                            <div>
                                <span class="info-label">Time</span>
                                <span class="info-value">${booking.time}</span>
                            </div>
                        </div>
                        <div class="booking-info-item">
                            <i class="fas fa-hourglass-half"></i>
                            <div>
                                <span class="info-label">Duration</span>
                                <span class="info-value">${booking.duration} hour${booking.duration > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div class="booking-info-row">
                        <div class="booking-info-item">
                            <i class="fas fa-rupee-sign"></i>
                            <div>
                                <span class="info-label">Amount</span>
                                <span class="info-value">₹${booking.amount || 0}</span>
                            </div>
                        </div>
                        <div class="booking-info-item">
                            <i class="fas fa-calendar-check"></i>
                            <div>
                                <span class="info-label">End Time</span>
                                <span class="info-value">${endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="booking-card-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewReceipt('${booking._id}')">
                        <i class="fas fa-receipt"></i> Receipt
                    </button>
                    ${canExtend ? `<button class="btn btn-primary btn-sm" onclick="showExtendModal('${booking._id}')">
                        <i class="fas fa-clock"></i> Extend
                    </button>` : ''}
                    ${canCancel ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking('${booking._id}')">
                        <i class="fas fa-times"></i> Cancel
                    </button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function filterMyBookings() {
    const statusFilter = document.getElementById('bookingStatusFilter')?.value || '';
    const locationFilter = document.getElementById('bookingLocationFilter')?.value || '';
    const dateFilter = document.getElementById('bookingDateFilter')?.value || '';
    
    filteredBookings = myBookings.filter(booking => {
        if (statusFilter && booking.status !== statusFilter) return false;
        if (locationFilter && booking.location !== locationFilter) return false;
        if (dateFilter && booking.date !== dateFilter) return false;
        return true;
    });
    
    displayMyBookings();
}

function updateBookingStats() {
    const active = myBookings.filter(b => b.status === 'active').length;
    const completed = myBookings.filter(b => b.status === 'completed').length;
    const cancelled = myBookings.filter(b => b.status === 'cancelled').length;
    const totalSpent = myBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
    
    document.getElementById('activeBookingsCount').textContent = active;
    document.getElementById('completedBookingsCount').textContent = completed;
    document.getElementById('cancelledBookingsCount').textContent = cancelled;
    document.getElementById('totalSpent').textContent = `₹${totalSpent}`;
}

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }
    
    try {
        await api.updateBooking(bookingId, { status: 'cancelled' });
        showMessage('Booking cancelled successfully', 'success');
        await loadMyBookings();
        // Refresh availability if on availability page
        if (currentSection === 'availability') {
            await initializeParkingSlots();
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        showMessage('Error cancelling booking. Please try again.', 'error');
    }
}

function showExtendModal(bookingId) {
    const booking = myBookings.find(b => b._id === bookingId);
    if (!booking) return;
    
    const bookingDate = new Date(`${booking.date} ${booking.time}`);
    const endDate = new Date(bookingDate.getTime() + booking.duration * 60 * 60 * 1000);
    
    document.getElementById('extendSlot').textContent = booking.slot;
    document.getElementById('extendLocation').textContent = booking.location || 'N/A';
    document.getElementById('extendCurrentEnd').textContent = endDate.toLocaleString('en-IN');
    document.getElementById('extendBookingForm').setAttribute('data-booking-id', bookingId);
    document.getElementById('extendDuration').value = '1';
    calculateExtendAmount();
    
    document.getElementById('extendBookingModal').style.display = 'block';
}

function closeExtendModal() {
    document.getElementById('extendBookingModal').style.display = 'none';
}

function calculateExtendAmount() {
    const duration = parseInt(document.getElementById('extendDuration').value);
    let amount = 0;
    switch(duration) {
        case 1: amount = 20; break;
        case 2: amount = 35; break;
        case 4: amount = 60; break;
        case 8: amount = 100; break;
    }
    document.getElementById('extendAmount').textContent = amount;
}

async function handleExtendBooking(e) {
    e.preventDefault();
    const bookingId = e.target.getAttribute('data-booking-id');
    const booking = myBookings.find(b => b._id === bookingId);
    if (!booking) return;
    
    const additionalDuration = parseInt(document.getElementById('extendDuration').value);
    const additionalAmount = parseInt(document.getElementById('extendAmount').textContent);
    
    try {
        // Calculate new duration and amount
        const newDuration = booking.duration + additionalDuration;
        const newAmount = booking.amount + additionalAmount;
        
        // Calculate new end time
        const bookingDate = new Date(`${booking.date} ${booking.time}`);
        const newEndDate = new Date(bookingDate.getTime() + newDuration * 60 * 60 * 1000);
        // Format as YYYY-MM-DD HH:MM
        const year = newEndDate.getFullYear();
        const month = String(newEndDate.getMonth() + 1).padStart(2, '0');
        const day = String(newEndDate.getDate()).padStart(2, '0');
        const hours = String(newEndDate.getHours()).padStart(2, '0');
        const minutes = String(newEndDate.getMinutes()).padStart(2, '0');
        const newEndAt = `${year}-${month}-${day} ${hours}:${minutes}`;
        
        // Update booking
        await api.updateBooking(bookingId, {
            duration: newDuration,
            amount: newAmount,
            end_at: newEndAt
        });
        
        showMessage('Booking extended successfully!', 'success');
        closeExtendModal();
        await loadMyBookings();
    } catch (error) {
        console.error('Error extending booking:', error);
        showMessage('Error extending booking. Please try again.', 'error');
    }
}

function viewReceipt(bookingId) {
    const booking = myBookings.find(b => b._id === bookingId);
    if (!booking) return;
    
    const bookingDate = new Date(`${booking.date} ${booking.time}`);
    const endDate = new Date(bookingDate.getTime() + booking.duration * 60 * 60 * 1000);
    const paymentDate = booking.created_at 
        ? new Date(booking.created_at).toLocaleString('en-IN')
        : bookingDate.toLocaleString('en-IN');
    
    const receiptHTML = `
        <div class="receipt">
            <div class="receipt-header">
                <h2>ParkEasy</h2>
                <p>Digital Parking System</p>
                <p>123 Parking Street, City Center, Pune, Maharashtra 411001</p>
                <p>Phone: +91 98765 43210 | Email: support@parkeasy.com</p>
            </div>
            <div class="receipt-body">
                <div class="receipt-section">
                    <h3>Booking Receipt</h3>
                    <p><strong>Receipt No:</strong> ${booking._id}</p>
                    <p><strong>Date:</strong> ${paymentDate}</p>
                </div>
                <div class="receipt-section">
                    <h4>Customer Details</h4>
                    <p><strong>Name:</strong> ${booking.customer_name}</p>
                    <p><strong>Vehicle Number:</strong> ${booking.vehicle_number}</p>
                </div>
                <div class="receipt-section">
                    <h4>Booking Details</h4>
                    <p><strong>Location:</strong> ${booking.location || 'N/A'}</p>
                    <p><strong>Slot:</strong> ${booking.slot}</p>
                    <p><strong>Date:</strong> ${booking.date}</p>
                    <p><strong>Time:</strong> ${booking.time}</p>
                    <p><strong>Duration:</strong> ${booking.duration} hour${booking.duration > 1 ? 's' : ''}</p>
                    <p><strong>End Time:</strong> ${endDate.toLocaleString('en-IN')}</p>
                </div>
                <div class="receipt-section">
                    <h4>Payment Details</h4>
                    <p><strong>Amount:</strong> ₹${booking.amount || 0}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${booking.status}">${booking.status}</span></p>
                </div>
            </div>
            <div class="receipt-footer">
                <p>Thank you for using ParkEasy!</p>
                <p>This is a computer-generated receipt.</p>
            </div>
        </div>
    `;
    
    document.getElementById('receiptBody').innerHTML = receiptHTML;
    document.getElementById('receiptModal').setAttribute('data-booking-id', bookingId);
    document.getElementById('receiptModal').style.display = 'block';
}

function closeReceiptModal() {
    document.getElementById('receiptModal').style.display = 'none';
}

function printReceipt() {
    const receiptContent = document.getElementById('receiptBody').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Booking Receipt</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .receipt { max-width: 600px; margin: 0 auto; }
                    .receipt-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
                    .receipt-section { margin: 20px 0; }
                    .receipt-footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; }
                    @media print { button { display: none; } }
                </style>
            </head>
            <body>
                ${receiptContent}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
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
    
    // Insert at the top of current section
    const currentSectionElement = document.querySelector('.section.active .container, .section.active');
    currentSectionElement.insertBefore(messageDiv, currentSectionElement.firstChild);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function setMinDate() {
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }
}

// CSS Animation for spinning
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .slot.selected {
        border-color: #667eea !important;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3) !important;
    }
`;
document.head.appendChild(style);

// Initialize slot dropdown on page load
document.addEventListener('DOMContentLoaded', function() {
    updateSlotDropdown();
});


// OpenStreetMap Integration using Leaflet
document.addEventListener('DOMContentLoaded', function() {
    const mapContainer = document.createElement('div');
    mapContainer.id = 'map';
    mapContainer.style.height = '400px';
    mapContainer.style.width = '100%';
    
    // Append the map below the home section if it exists
    const homeSection = document.getElementById('home');
    if (homeSection) {
        homeSection.appendChild(mapContainer);
    } else {
        document.body.appendChild(mapContainer);
    }

    // Initialize map centered on Mumbai
    const map = L.map('map').setView([19.0760, 72.8777], 11);

    // Use OpenStreetMap tiles (no API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Demo locations in Mumbai
    const demoLocations = [
        { name: 'CityMall', coords: [19.1176, 72.9060] },        // Ghatkopar vicinity
        { name: 'TechPark', coords: [19.1075, 72.8376] },        // BKC vicinity
        { name: 'CentralOffice', coords: [18.9440, 72.8231] },   // Fort/Colaba vicinity
        { name: 'Airport', coords: [19.0896, 72.8656] },         // Mumbai Airport
        { name: 'Stadium', coords: [19.0004, 72.8258] }          // Wankhede vicinity
    ];

    demoLocations.forEach(loc => {
        L.marker(loc.coords)
            .addTo(map)
            .bindPopup(`${loc.name}`);
    });
});
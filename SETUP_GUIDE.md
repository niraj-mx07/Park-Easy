# Parking System - Complete Setup Guide

This guide will help you set up the complete parking system with frontend and backend.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

1. **Python 3.8 or higher**
   - Download from: https://www.python.org/downloads/
   - Make sure to check "Add Python to PATH" during installation

2. **MongoDB**
   - Download from: https://www.mongodb.com/try/download/community
   - Install and start MongoDB service

3. **Web Browser** (Chrome, Firefox, Edge, etc.)

## 🚀 Quick Start

### Step 1: Start MongoDB
1. Open Command Prompt or PowerShell as Administrator
2. Navigate to MongoDB installation directory (usually `C:\Program Files\MongoDB\Server\6.0\bin`)
3. Run: `mongod --dbpath C:\data\db`
   - If the directory doesn't exist, create it first: `mkdir C:\data\db`

### Step 2: Start the Backend Server
1. Open Command Prompt in the Backend directory:
   ```bash
   cd "c:\Sem Demo\Backend"
   ```

2. **Option A: Use the batch file (Windows)**
   ```bash
   start_server.bat
   ```

3. **Option B: Manual setup**
   ```bash
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Start server
   python run.py
   ```

### Step 3: Open the Frontend
1. Navigate to the Frontend directory: `c:\Sem Demo\Frontend`
2. Open `landing.html` in your web browser
3. Choose your role (Admin or Customer) to start using the system

## 🔧 Detailed Setup

### Backend Setup (Python Flask + MongoDB)

#### 1. Install Python Dependencies
```bash
cd "c:\Sem Demo\Backend"
pip install -r requirements.txt
```

#### 2. Configure MongoDB
- Make sure MongoDB is running on `mongodb://localhost:27017/`
- The database name is `parking_system`
- Collections will be created automatically

#### 3. Start the Backend Server
```bash
python run.py
```

The API will be available at: `http://localhost:5000`

### Frontend Setup (HTML/CSS/JavaScript)

#### 1. Open the Landing Page
- Navigate to: `c:\Sem Demo\Frontend\landing.html`
- Open in your web browser

#### 2. Access Points
- **Landing Page**: `landing.html` - Choose your role
- **Customer Interface**: `index.html` - Book parking slots
- **Admin Interface**: `admin.html` - Manage bookings and view analytics

## 🔑 Default Login Credentials

### Admin Access
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Administrator

### Customer Access
- **Username**: `customer`
- **Password**: `customer123`
- **Role**: Customer

## 📊 System Features

### Customer Features
- ✅ View available parking slots
- ✅ Book parking slots
- ✅ Make payments
- ✅ View booking history

### Admin Features
- ✅ Dashboard with statistics
- ✅ View all bookings
- ✅ Manage booking status
- ✅ Delete bookings
- ✅ Export data to Excel
- ✅ View parking slot status
- ✅ Real-time revenue tracking

## 🛠️ Troubleshooting

### Common Issues

#### 1. MongoDB Connection Error
**Error**: `pymongo.errors.ServerSelectionTimeoutError`
**Solution**: 
- Make sure MongoDB is running
- Check if MongoDB service is started
- Verify connection string in `app.py`

#### 2. Python Module Not Found
**Error**: `ModuleNotFoundError: No module named 'flask'`
**Solution**:
```bash
pip install -r requirements.txt
```

#### 3. Port Already in Use
**Error**: `Address already in use`
**Solution**:
- Change port in `app.py` or `run.py`
- Kill existing process using the port

#### 4. CORS Issues
**Error**: `CORS policy: No 'Access-Control-Allow-Origin'`
**Solution**:
- Make sure backend is running on `http://localhost:5000`
- Check CORS configuration in `app.py`

### Backend Logs
Check the console output for detailed error messages:
```bash
python run.py
```

### Frontend Console
Open browser Developer Tools (F12) to see JavaScript errors.

## 📁 Project Structure

```
Sem Demo/
├── Backend/
│   ├── app.py              # Main Flask application
│   ├── models.py           # Database models
│   ├── config.py           # Configuration
│   ├── requirements.txt    # Python dependencies
│   ├── run.py              # Server startup script
│   ├── start_server.bat    # Windows batch file
│   └── README.md           # Backend documentation
├── Frontend/
│   ├── landing.html        # Landing page
│   ├── index.html          # Customer interface
│   ├── admin.html          # Admin interface
│   ├── script.js           # Customer JavaScript
│   ├── admin.js            # Admin JavaScript
│   ├── api.js              # API service
│   └── style.css           # Styling
└── SETUP_GUIDE.md          # This file
```

## 🔄 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Parking Management
- `GET /api/parking-slots` - Get all parking slots
- `PUT /api/parking-slots/<slot_id>` - Update parking slot

### Booking Management
- `GET /api/bookings` - Get bookings
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/<booking_id>` - Update booking
- `DELETE /api/bookings/<booking_id>` - Delete booking

### Admin Dashboard
- `GET /api/admin/stats` - Get statistics
- `GET /api/admin/export` - Export bookings

## 🚀 Production Deployment

For production deployment:

1. **Change Secret Keys**
   - Update `SECRET_KEY` and `JWT_SECRET_KEY` in `config.py`

2. **Database Security**
   - Set up MongoDB authentication
   - Use environment variables for connection strings

3. **Server Configuration**
   - Use a production WSGI server (Gunicorn)
   - Set up reverse proxy (Nginx)
   - Enable HTTPS

4. **Environment Variables**
   ```env
   FLASK_ENV=production
   SECRET_KEY=your-production-secret-key
   JWT_SECRET_KEY=your-jwt-secret-key
   MONGODB_URI=mongodb://username:password@localhost:27017/parking_system
   ```

## 📞 Support

If you encounter any issues:

1. Check the console logs for error messages
2. Verify all prerequisites are installed
3. Ensure MongoDB is running
4. Check network connectivity between frontend and backend

## 🎯 Next Steps

1. **Customize the system**:
   - Modify parking slot layout
   - Add new user roles
   - Implement additional features

2. **Enhance security**:
   - Add input validation
   - Implement rate limiting
   - Add audit logging

3. **Scale the system**:
   - Add load balancing
   - Implement caching
   - Add monitoring

---

**Happy Parking! 🚗**







# Parking System Backend

A Python Flask backend API for the digital parking system with MongoDB database.

## Features

- **User Authentication**: JWT-based authentication for admin and customer users
- **Parking Management**: Real-time parking slot availability
- **Booking System**: Complete booking lifecycle management
- **Admin Dashboard**: Statistics and booking management
- **Data Export**: Export booking data for analysis

## Prerequisites

- Python 3.8 or higher
- MongoDB 4.4 or higher
- pip (Python package installer)

## Installation

1. **Clone or navigate to the backend directory**
   ```bash
   cd "c:\Sem Demo\Backend"
   ```

2. **Create a virtual environment (recommended)**
   ```bash
   python -m venv venv
   venv\Scripts\activate  # On Windows
   # or
   source venv/bin/activate  # On Linux/Mac
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start MongoDB**
   - Make sure MongoDB is running on your system
   - Default connection: `mongodb://localhost:27017/`

5. **Run the application**
   ```bash
   python app.py
   ```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Parking Slots
- `GET /api/parking-slots` - Get all parking slots
- `PUT /api/parking-slots/<slot_id>` - Update parking slot (Admin only)

### Bookings
- `GET /api/bookings` - Get bookings (Admin: all, Customer: own)
- `POST /api/bookings` - Create new booking
- `PUT /api/bookings/<booking_id>` - Update booking
- `DELETE /api/bookings/<booking_id>` - Delete booking (Admin only)

### Admin Dashboard
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/export` - Export all bookings data

### Health Check
- `GET /api/health` - API health status

## Default Users

The system creates default users on first run:

**Admin User:**
- Username: `admin`
- Password: `admin123`
- Role: `admin`

**Customer User:**
- Username: `customer`
- Password: `customer123`
- Role: `customer`

## Database Structure

### Users Collection
```json
{
  "_id": "ObjectId",
  "username": "string",
  "password": "hashed_string",
  "role": "admin|customer",
  "created_at": "datetime"
}
```

### Bookings Collection
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "customer_name": "string",
  "vehicle_number": "string",
  "slot": "string",
  "date": "string",
  "time": "string",
  "duration": "number",
  "amount": "number",
  "status": "active|completed|cancelled",
  "created_at": "datetime"
}
```

### Parking Slots Collection
```json
{
  "_id": "ObjectId",
  "slot_id": "string",
  "status": "available|booked",
  "booked_by": "string|null",
  "created_at": "datetime"
}
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=parking_system
```

## CORS Configuration

The API is configured to accept requests from:
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `file://` (for local HTML files)

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Security Features

- Password hashing using Werkzeug
- JWT token-based authentication
- Role-based access control
- CORS protection
- Input validation

## Development

To run in development mode:
```bash
export FLASK_ENV=development
python app.py
```

## Production Deployment

For production deployment:
1. Change secret keys in `config.py`
2. Use environment variables for sensitive data
3. Set up proper MongoDB authentication
4. Use a production WSGI server like Gunicorn
5. Set up reverse proxy with Nginx







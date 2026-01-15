#!/usr/bin/env python3
"""
Parking System Backend Server
Run this script to start the Flask development server
"""

import os
import sys
from app import app, initialize_data

def main():
    """Main function to start the server"""
    print("🚗 Starting Parking System Backend Server...")
    print("=" * 50)
    
    # Initialize database with default data
    print("📊 Initializing database...")
    initialize_data()
    print("✅ Database initialized successfully")
    
    # Get configuration
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    print(f"🌐 Server will run on: http://{host}:{port}")
    print(f"🔧 Debug mode: {'ON' if debug else 'OFF'}")
    print("=" * 50)
    print("📋 Available endpoints:")
    print("   POST /api/auth/login - User login")
    print("   POST /api/auth/register - User registration")
    print("   GET  /api/parking-slots - Get parking slots")
    print("   GET  /api/bookings - Get bookings")
    print("   POST /api/bookings - Create booking")
    print("   GET  /api/admin/stats - Admin statistics")
    print("   GET  /api/health - Health check")
    print("=" * 50)
    print("🔑 Default users:")
    print("   Admin: admin / admin123")
    print("   Customer: customer / customer123")
    print("=" * 50)
    print("🚀 Starting server...")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        app.run(host=host, port=port, debug=debug)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()


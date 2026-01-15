from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
from pymongo import MongoClient
from bson import ObjectId
import json

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "dev-secret")
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

jwt = JWTManager(app)
CORS(app)

# MongoDB connection
MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "parking_system")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI environment variable not set")

client = MongoClient(MONGODB_URI)
db = client[DATABASE_NAME]

# Collections
users_collection = db['users']
bookings_collection = db['bookings']
parking_slots_collection = db['parking_slots']

def _parse_booking_times(date_str: str, time_str: str, duration_hours: int):
    """Parse date, time, duration into start and end datetimes (UTC-naive for simplicity)."""
    try:
        start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    except ValueError:
        # Fallback: try H:M without leading zeros
        start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    end_dt = start_dt + timedelta(hours=duration_hours)
    return start_dt, end_dt

def reconcile_expired_and_slots(target_location: str | None = None):
    """
    - Mark active bookings whose end time has passed as completed and free their slots.
    - Ensure slot.status reflects active bookings (booked/available) per location filter if provided.
    """
    now_dt = datetime.utcnow()

    # 1) Expire bookings
    active_cursor = bookings_collection.find({'status': 'active'})
    for b in active_cursor:
        try:
            start_dt, end_dt = _parse_booking_times(b['date'], b['time'], int(b['duration']))
            if end_dt <= now_dt:
                # mark completed and free slot
                bookings_collection.update_one({'_id': b['_id']}, {'$set': {'status': 'completed'}})
                parking_slots_collection.update_one(
                    {'slot_id': b.get('slot'), 'location': b.get('location')},
                    {'$set': {'status': 'available', 'booked_by': None}}
                )
        except Exception:
            # On parse issues, skip
            continue

    # 2) Reconcile slot statuses to match active bookings
    match = {'status': 'active'}
    if target_location:
        match['location'] = target_location
    active = list(bookings_collection.find(match, {'slot': 1, 'location': 1, 'customer_name': 1}))
    active_keys = {(a.get('location'), a.get('slot')) for a in active}
    name_map = {(a.get('location'), a.get('slot')): a.get('customer_name') for a in active}

    slot_filter = {}
    if target_location:
        slot_filter['location'] = target_location
    slots = list(parking_slots_collection.find(slot_filter, {'slot_id': 1, 'location': 1}))
    for s in slots:
        key = (s.get('location'), s.get('slot_id'))
        if key in active_keys:
            parking_slots_collection.update_one(
                {'_id': s['_id']},
                {'$set': {'status': 'booked', 'booked_by': name_map.get(key)}}
            )
        else:
            parking_slots_collection.update_one(
                {'_id': s['_id']},
                {'$set': {'status': 'available', 'booked_by': None}}
            )

# Initialize default data
def initialize_data():
    # Create default admin user
    admin_user = users_collection.find_one({'username': 'admin'})
    if not admin_user:
        users_collection.insert_one({
            'username': 'admin',
            'password': generate_password_hash('admin123'),
            'role': 'admin',
            'created_at': datetime.utcnow()
        })
    
    # Create default customer user
    customer_user = users_collection.find_one({'username': 'customer'})
    if not customer_user:
        users_collection.insert_one({
            'username': 'customer',
            'password': generate_password_hash('customer123'),
            'role': 'customer',
            'created_at': datetime.utcnow()
        })
    
    # Initialize/migrate parking slots to support multiple locations and floors (no zones in API)
    rows = ['A', 'B', 'C', 'D']
    nums = ['1', '2', '3']
    locations = ['CityMall', 'TechPark', 'CentralOffice', 'Airport', 'Stadium']

    existing_slots = list(parking_slots_collection.find({}))

    if len(existing_slots) == 0:
        # Fresh database: create slots for each location (2 floors × 12 per floor)
        slots_to_create = []
        for location in locations:
            for floor in [1, 2]:
                for row in rows:
                    for num in nums:
                        slots_to_create.append({
                            'slot_id': f'F{floor}-{row}{num}',
                            'location': location,
                            'floor': floor,
                            'status': 'available',
                            'booked_by': None,
                            'created_at': datetime.utcnow()
                        })
        if slots_to_create:
            parking_slots_collection.insert_many(slots_to_create)
    else:
        # Migration path: add floor and location (default), remove zone usage
        for slot in existing_slots:
            slot_id = str(slot.get('slot_id', '')).strip()
            updated_fields = {}

            # Default floor=1 if missing
            if 'floor' not in slot:
                updated_fields['floor'] = 1

            # Default location if missing
            if 'location' not in slot:
                updated_fields['location'] = 'CityMall'

            # Normalize slot_id to include floor prefix
            if slot_id and not slot_id.startswith('F'):
                updated_fields['slot_id'] = f"F{updated_fields.get('floor', slot.get('floor', 1))}-{slot_id}"

            if updated_fields:
                parking_slots_collection.update_one({'_id': slot['_id']}, {'$set': updated_fields})

        # Ensure all locations have full sets of slots (2 floors × 12 per floor)
        for location in locations:
            for floor in [1, 2]:
                for row in rows:
                    for num in nums:
                        slot_id = f'F{floor}-{row}{num}'
                        if parking_slots_collection.count_documents({'location': location, 'slot_id': slot_id}) == 0:
                            parking_slots_collection.insert_one({
                                'slot_id': slot_id,
                                'location': location,
                                'floor': floor,
                                'status': 'available',
                                'booked_by': None,
                                'created_at': datetime.utcnow()
                            })

        # Reconcile slot statuses with active bookings (fix stale booked flags)
        active_bookings = list(bookings_collection.find({'status': 'active'}))
        booked_keys = set()
        name_by_key = {}
        for b in active_bookings:
            key = (b.get('location'), b.get('slot'))
            booked_keys.add(key)
            name_by_key[key] = b.get('customer_name')

        # Mark slots booked if in active bookings, else available
        for location in locations:
            for floor in [1, 2]:
                for row in rows:
                    for num in nums:
                        sid = f'F{floor}-{row}{num}'
                        key = (location, sid)
                        if key in booked_keys:
                            parking_slots_collection.update_one(
                                {'location': location, 'slot_id': sid},
                                {'$set': {'status': 'booked', 'booked_by': name_by_key.get(key)}}
                            )
                        else:
                            parking_slots_collection.update_one(
                                {'location': location, 'slot_id': sid},
                                {'$set': {'status': 'available', 'booked_by': None}}
                            )

# Initialize DB data on startup (works with gunicorn & local)
initialize_data()

# Authentication Routes
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        user = users_collection.find_one({'username': username})
        if not user or not check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        access_token = create_access_token(identity=str(user['_id']))
        return jsonify({
            'access_token': access_token,
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'role': user['role']
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        role = data.get('role', 'customer')
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        # Check if user already exists
        if users_collection.find_one({'username': username}):
            return jsonify({'error': 'Username already exists'}), 400
        
        # Create new user
        user = {
            'username': username,
            'password': generate_password_hash(password),
            'role': role,
            'created_at': datetime.utcnow()
        }
        
        result = users_collection.insert_one(user)
        user['_id'] = result.inserted_id
        
        access_token = create_access_token(identity=str(user['_id']))
        return jsonify({
            'access_token': access_token,
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'role': user['role']
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Parking Slots Routes
@app.route('/api/parking-slots', methods=['GET'])
def get_parking_slots():
    try:
        # Optional filters: location, floor, status
        query = {}
        location_param = request.args.get('location')
        floor_param = request.args.get('floor')
        status_param = request.args.get('status')

        # Reconcile before serving data to avoid phantom booked slots
        reconcile_expired_and_slots(location_param)

        if location_param:
            query['location'] = location_param
        if floor_param:
            try:
                query['floor'] = int(floor_param)
            except ValueError:
                pass
        if status_param:
            query['status'] = status_param

        slots = list(parking_slots_collection.find(query))
        for slot in slots:
            slot['_id'] = str(slot['_id'])
        return jsonify(slots), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/parking-slots/<slot_id>', methods=['PUT'])
@jwt_required()
def update_parking_slot(slot_id):
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Check if user is admin
        user = users_collection.find_one({'_id': ObjectId(current_user_id)})
        if user['role'] != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        result = parking_slots_collection.update_one(
            {'slot_id': slot_id},
            {'$set': data}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Slot not found'}), 404
        
        return jsonify({'message': 'Slot updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Bookings Routes
@app.route('/api/bookings', methods=['GET'])
@jwt_required()
def get_bookings():
    try:
        # Expire any past bookings before returning
        reconcile_expired_and_slots(None)

        current_user_id = get_jwt_identity()
        user = users_collection.find_one({'_id': ObjectId(current_user_id)})
        
        # Admin can see all bookings, customers see only their own
        if user['role'] == 'admin':
            bookings = list(bookings_collection.find())
        else:
            bookings = list(bookings_collection.find({'user_id': current_user_id}))
        
        for booking in bookings:
            booking['_id'] = str(booking['_id'])
            booking['user_id'] = str(booking['user_id'])
        
        return jsonify(bookings), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bookings', methods=['POST'])
@jwt_required()
def create_booking():
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Check if slot is available
        slot = parking_slots_collection.find_one({'slot_id': data['slot'], 'location': data.get('location')})
        if not slot or slot['status'] != 'available':
            return jsonify({'error': 'Slot not available'}), 400
        
        # Calculate start/end
        start_dt, end_dt = _parse_booking_times(data['date'], data['time'], int(data['duration']))

        # Create booking
        booking = {
            'user_id': current_user_id,
            'customer_name': data['name'],
            'vehicle_number': data['vehicle'],
            'slot': data['slot'],
            'location': slot.get('location'),
            'floor': slot.get('floor', 1),
            'date': data['date'],
            'time': data['time'],
            'duration': int(data['duration']),
            'amount': data['amount'],
            'status': 'active',
            'start_at': start_dt.strftime("%Y-%m-%d %H:%M"),
            'end_at': end_dt.strftime("%Y-%m-%d %H:%M"),
            'created_at': datetime.utcnow()
        }
        
        result = bookings_collection.insert_one(booking)
        booking['_id'] = str(result.inserted_id)
        
        # Update slot status
        parking_slots_collection.update_one(
            {'slot_id': data['slot']},
            {'$set': {'status': 'booked', 'booked_by': data['name']}}
        )
        
        return jsonify(booking), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bookings/<booking_id>', methods=['PUT'])
@jwt_required()
def update_booking(booking_id):
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Check if user is admin or booking owner
        user = users_collection.find_one({'_id': ObjectId(current_user_id)})
        booking = bookings_collection.find_one({'_id': ObjectId(booking_id)})
        
        if not booking:
            return jsonify({'error': 'Booking not found'}), 404
        
        if user['role'] != 'admin' and str(booking['user_id']) != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        result = bookings_collection.update_one(
            {'_id': ObjectId(booking_id)},
            {'$set': data}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Booking not found'}), 404

        # If status was updated to completed/cancelled, free up the slot
        new_status = data.get('status')
        if new_status in ['completed', 'cancelled']:
            slot_id = booking.get('slot')
            location = booking.get('location')
            if slot_id and location:
                parking_slots_collection.update_one(
                    {'slot_id': slot_id, 'location': location},
                    {'$set': {'status': 'available', 'booked_by': None}}
                )
        
        return jsonify({'message': 'Booking updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bookings/<booking_id>', methods=['DELETE'])
@jwt_required()
def delete_booking(booking_id):
    try:
        current_user_id = get_jwt_identity()
        
        # Check if user is admin
        user = users_collection.find_one({'_id': ObjectId(current_user_id)})
        if user['role'] != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        booking = bookings_collection.find_one({'_id': ObjectId(booking_id)})
        if not booking:
            return jsonify({'error': 'Booking not found'}), 404
        
        # Free up the slot
        parking_slots_collection.update_one(
            {'slot_id': booking['slot']},
            {'$set': {'status': 'available', 'booked_by': None}}
        )
        
        # Delete booking
        bookings_collection.delete_one({'_id': ObjectId(booking_id)})
        
        return jsonify({'message': 'Booking deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Admin Dashboard Routes
@app.route('/api/admin/stats', methods=['GET'])
@jwt_required()
def get_admin_stats():
    try:
        current_user_id = get_jwt_identity()
        user = users_collection.find_one({'_id': ObjectId(current_user_id)})
        
        if user['role'] != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        # Calculate stats
        total_bookings = bookings_collection.count_documents({})
        active_bookings = bookings_collection.count_documents({'status': 'active'})
        
        # Calculate total revenue
        revenue_pipeline = [
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
        ]
        revenue_result = list(bookings_collection.aggregate(revenue_pipeline))
        total_revenue = revenue_result[0]['total'] if revenue_result else 0
        
        # Count available slots
        available_slots = parking_slots_collection.count_documents({'status': 'available'})
        
        return jsonify({
            'total_bookings': total_bookings,
            'active_bookings': active_bookings,
            'total_revenue': total_revenue,
            'available_slots': available_slots
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/export', methods=['GET'])
@jwt_required()
def export_bookings():
    try:
        current_user_id = get_jwt_identity()
        user = users_collection.find_one({'_id': ObjectId(current_user_id)})
        
        if user['role'] != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        bookings = list(bookings_collection.find())
        for booking in bookings:
            booking['_id'] = str(booking['_id'])
            booking['user_id'] = str(booking['user_id'])
        
        return jsonify(bookings), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Health check
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'OK', 'message': 'Parking System API is running'}), 200

if __name__ == '__main__':
    app.run(debug=True)




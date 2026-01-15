from pymongo import MongoClient
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId

class Database:
    def __init__(self, uri='mongodb://localhost:27017/', db_name='parking_system'):
        self.client = MongoClient(uri)
        self.db = self.client[db_name]
        self.users = self.db['users']
        self.bookings = self.db['bookings']
        self.parking_slots = self.db['parking_slots']

class User:
    def __init__(self, username, password, role='customer'):
        self.username = username
        self.password = generate_password_hash(password)
        self.role = role
        self.created_at = datetime.utcnow()
    
    def to_dict(self):
        return {
            'username': self.username,
            'password': self.password,
            'role': self.role,
            'created_at': self.created_at
        }
    
    @staticmethod
    def verify_password(password_hash, password):
        return check_password_hash(password_hash, password)

class Booking:
    def __init__(self, user_id, customer_name, vehicle_number, slot, date, time, duration, amount, status='active'):
        self.user_id = user_id
        self.customer_name = customer_name
        self.vehicle_number = vehicle_number
        self.slot = slot
        self.date = date
        self.time = time
        self.duration = duration
        self.amount = amount
        self.status = status
        self.created_at = datetime.utcnow()
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'customer_name': self.customer_name,
            'vehicle_number': self.vehicle_number,
            'slot': self.slot,
            'date': self.date,
            'time': self.time,
            'duration': self.duration,
            'amount': self.amount,
            'status': self.status,
            'created_at': self.created_at
        }

class ParkingSlot:
    def __init__(self, slot_id, status='available', booked_by=None):
        self.slot_id = slot_id
        self.status = status
        self.booked_by = booked_by
        self.created_at = datetime.utcnow()
    
    def to_dict(self):
        return {
            'slot_id': self.slot_id,
            'status': self.status,
            'booked_by': self.booked_by,
            'created_at': self.created_at
        }







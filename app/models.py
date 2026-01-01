from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Association Table for Boards <-> Images
board_images = db.Table('board_images',
    db.Column('board_id', db.Integer, db.ForeignKey('board.id'), primary_key=True),
    db.Column('image_id', db.Integer, db.ForeignKey('image.id'), primary_key=True),
    db.Column('added_at', db.DateTime, default=datetime.utcnow),
    db.Column('position', db.Integer, default=0)
)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, index=True)
    password_hash = db.Column(db.String(128))
    credits = db.Column(db.Integer, default=100)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_admin = db.Column(db.Boolean, default=False)

    boards = db.relationship('Board', backref='owner', lazy='dynamic')
    images = db.relationship('Image', backref='uploader', lazy='dynamic')
    transactions = db.relationship('CreditTransaction', backref='user', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# class Image(db.Model):
#     id = db.Column(db.Integer, primary_key=True)
#     url = db.Column(db.String(255), nullable=False)
#     
#     # Prompt is the Core Product
#     prompt = db.Column(db.Text, nullable=False)
#     positive_prompt = db.Column(db.Text) # Short version
#     negative_prompt = db.Column(db.Text)
#     
#     # Metadata
#     width = db.Column(db.Integer)
#     height = db.Column(db.Integer)
#     aspect_ratio = db.Column(db.String(20)) # "16:9"
#     
#     # Vibe Data
#     lighting = db.Column(db.String(100))
#     mood = db.Column(db.String(100))
#     colors = db.Column(db.JSON) # ["#hex", "#hex"]
#     tags = db.Column(db.JSON)   # ["tag1", "tag2"]
#     
#     # Source
#     source_video_url = db.Column(db.String(255))
#     created_by_id = db.Column(db.Integer, db.ForeignKey('user.id'))
#     is_public = db.Column(db.Boolean, default=True)
#     copy_count = db.Column(db.Integer, default=0)

# class Board(db.Model):
#     id = db.Column(db.Integer, primary_key=True)
#     name = db.Column(db.String(64))
#     user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
#     is_public = db.Column(db.Boolean, default=False)
#     created_at = db.Column(db.DateTime, default=datetime.utcnow)
#     
#     images = db.relationship('Image', secondary=board_images, lazy='dynamic',
#                            backref=db.backref('boards', lazy='dynamic'))

class CreditTransaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    amount = db.Column(db.Integer) # Negative for spend, + for buy
    action_type = db.Column(db.String(50)) # "copy_prompt", "signup_bonus"
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

import os
from dotenv import load_dotenv

load_dotenv()
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///vibecheck.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Supabase
    SUPABASE_URL = os.environ.get('SUPABASE_URL') or 'https://thyjcbopkrdijmmnsnbk.supabase.co'
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY') or 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tZnhxdWx0cGpodmZsamd6eXhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk1NDE4NSwiZXhwIjoyMDgxNTMwMTg1fQ.-VXi1oan8XhoL7EJIj-Da6JURvftSQG-ji_WsGmnEqg'
    
    # Straico AI
    STRAICO_API_KEY = os.environ.get('STRAICO_API_KEY') or 'Iy-IwLzXyd86QKbD0A1B2ST0TOJppQhhsicwTJLbXXRFmHDlTVq'

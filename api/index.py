"""
Vercel Serverless Function Entrypoint for RailGo FastAPI
"""
import sys
import os

# Ensure project root is on Python sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

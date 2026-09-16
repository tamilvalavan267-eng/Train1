"""
RailGo Database Layer
Defines SQLite relational schema using SQLAlchemy for trains, schedules, coordinates,
live train telemetry, signal conditions, construction blocks, weather, and AI predictions.
"""

import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'railgo.db')
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Train(Base):
    __tablename__ = "trains"

    train_number = Column(Integer, primary_key=True, index=True)
    train_name = Column(String(100), nullable=False)
    train_type = Column(String(50), default="EMU Local")
    source = Column(String(50), default="MASS")
    destination = Column(String(50), default="TRL")
    route = Column(String(100), default="MASS-TRL Suburban Corridor")


class StationCoordinate(Base):
    __tablename__ = "station_coordinates"

    sequence = Column(Integer, primary_key=True)
    station_code = Column(String(10), unique=True, nullable=False)
    station_name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    distance_km = Column(Float, default=0.0)
    platforms = Column(Integer, default=2)
    zone = Column(String(10), default="SR")
    division = Column(String(10), default="MAS")


class StationSchedule(Base):
    __tablename__ = "station_schedule"

    id = Column(Integer, primary_key=True, autoincrement=True)
    train_number = Column(Integer, ForeignKey("trains.train_number"), index=True)
    station = Column(String(100), nullable=False)
    sequence = Column(Integer, nullable=False)
    scheduled_arrival = Column(String(20))
    scheduled_departure = Column(String(20))
    actual_arrival = Column(String(20))
    actual_departure = Column(String(20))
    platform = Column(Integer, default=1)


class LiveTrainStatus(Base):
    __tablename__ = "live_train_status"

    train_number = Column(Integer, ForeignKey("trains.train_number"), primary_key=True)
    current_station = Column(String(100), default="MASS")
    current_speed = Column(Float, default=45.0)
    current_delay = Column(Float, default=0.0)
    previous_station = Column(String(100), default="")
    next_station = Column(String(100), default="BBQ")
    running_status = Column(String(50), default="On Time")
    platform = Column(Integer, default=2)
    delay_reason = Column(String(100), default="Normal")
    delay_description = Column(Text, default="")
    data_status = Column(String(50), default="🟢 LIVE (Official Timetable)")
    last_updated = Column(DateTime, default=datetime.utcnow)


class SignalCondition(Base):
    __tablename__ = "signal_conditions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    section = Column(String(100), nullable=False, unique=True)
    signal_status = Column(String(20), default="Normal")  # Normal, Warning, Critical, Unavailable
    signal_waiting = Column(Float, default=0.0)  # minutes
    block_status = Column(String(20), default="Clear")   # Clear, Occupied, Restricted
    track_occupancy = Column(Float, default=0.2)
    data_status = Column(String(50), default="🟢 OPERATIONAL TELEMETRY")
    timestamp = Column(DateTime, default=datetime.utcnow)


class ConstructionWork(Base):
    __tablename__ = "construction_work"

    id = Column(Integer, primary_key=True, autoincrement=True)
    section = Column(String(100), nullable=False)
    start_station = Column(String(50))
    end_station = Column(String(50))
    work_type = Column(String(100))  # Track renewal, Bridge work, Electrification, TSR
    status = Column(String(30), default="Active")  # Active, Planned, Major restriction, Completed
    start_time = Column(String(30))
    end_time = Column(String(30))
    speed_restriction = Column(Float, default=0.0)  # km/h, e.g. 20
    affected_route = Column(String(100), default="MASS-TRL")
    expected_delay_impact = Column(Float, default=3.0)  # min
    data_status = Column(String(50), default="🟢 AUTHORISED RAILWAY ENGINEERING")
    last_updated = Column(DateTime, default=datetime.utcnow)


class WeatherRecord(Base):
    __tablename__ = "weather"

    station = Column(String(100), primary_key=True)
    station_code = Column(String(10))
    latitude = Column(Float)
    longitude = Column(Float)
    temperature = Column(Float)
    humidity = Column(Float)
    apparent_temperature = Column(Float)
    precipitation = Column(Float)
    rain = Column(Float)
    showers = Column(Float)
    weather_code = Column(Integer)
    cloud_cover = Column(Float)
    visibility = Column(Float)
    pressure = Column(Float)
    wind_speed = Column(Float)
    wind_direction = Column(Float)
    wind_gusts = Column(Float)
    weather_impact = Column(String(20), default="LOW")
    weather_desc = Column(String(100), default="Clear")
    observation_time = Column(String(50))
    data_status = Column(String(50), default="🟢 LIVE (Open-Meteo API)")
    last_updated = Column(DateTime, default=datetime.utcnow)


class PredictionRecord(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    train_number = Column(Integer, ForeignKey("trains.train_number"))
    predicted_additional_delay = Column(Float)
    predicted_eta = Column(String(30))
    prediction_range = Column(String(50))
    risk_level = Column(String(20))
    factors_json = Column(Text)
    prediction_timestamp = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")


if __name__ == '__main__':
    init_db()

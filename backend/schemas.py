"""
RailGo API Schemas
Pydantic data models for REST requests, responses, WebSocket payloads, and scenario inputs.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class StationCoordinateSchema(BaseModel):
    sequence: int
    station_code: str
    station_name: str
    latitude: float
    longitude: float
    distance_km: float
    platforms: int
    zone: str
    division: str

    class Config:
        from_attributes = True


class TrainSummarySchema(BaseModel):
    train_number: int
    train_name: str
    train_type: str
    source: str
    destination: str
    route: str
    current_station: str
    previous_station: str
    next_station: str
    current_speed: float
    current_delay: float
    running_status: str
    platform: int
    delay_reason: str
    delay_description: str
    ai_predicted_eta: str
    predicted_additional_delay: float
    risk_level: str
    prediction_range: str
    weather_condition: str
    weather_impact: str
    signal_status: str
    signal_waiting_time: float
    construction_status: str
    speed_restriction: float
    congestion_level: float
    data_status: str
    last_updated: str


class WeatherDetailSchema(BaseModel):
    station: str
    station_code: str
    latitude: float
    longitude: float
    temperature: float
    humidity: float
    apparent_temperature: float
    precipitation: float
    rain: float
    showers: float
    weather_code: int
    weather_desc: str
    cloud_cover: float
    visibility: float
    pressure: float
    wind_speed: float
    wind_direction: float
    wind_gusts: float
    weather_impact: str
    observation_time: str
    data_status: str
    last_updated: str


class SignalConditionSchema(BaseModel):
    section: str
    signal_status: str
    signal_waiting: float
    block_status: str
    track_occupancy: float
    data_status: str
    timestamp: str


class ConstructionWorkSchema(BaseModel):
    section: str
    start_station: str
    end_station: str
    work_type: str
    status: str
    start_time: str
    end_time: str
    speed_restriction: float
    affected_route: str
    expected_delay_impact: float
    data_status: str
    last_updated: str


class StationETASchema(BaseModel):
    sequence: int
    station_code: str
    station_name: str
    distance_km: float
    scheduled_eta: str
    ai_predicted_eta: str
    predicted_additional_delay: float
    running_status: str
    conditions_summary: str
    risk_level: str
    platform: int
    delay_minutes: Optional[float] = 0.0


class AIFactorExplanation(BaseModel):
    category: str
    impact_level: str
    estimated_minutes: float
    description: str


class TrainETAResponse(BaseModel):
    train_number: int
    train_name: str
    source: str
    destination: str
    current_station: str
    current_speed: float
    current_delay: float
    scheduled_arrival: str
    dynamic_ai_eta: str
    predicted_additional_delay: float
    prediction_range: str
    risk_level: str
    data_status: str
    station_wise_eta: List[StationETASchema]
    ai_explanations: List[AIFactorExplanation]
    weather_impact: str
    signal_summary: str
    construction_summary: str


class ScenarioSimulationRequest(BaseModel):
    train_number: int = Field(default=43205)
    signal_waiting_minutes: float = Field(default=8.0, ge=0.0, le=45.0)
    signal_status: str = Field(default="Warning")  # Normal, Warning, Critical
    construction_active: bool = Field(default=True)
    speed_restriction_kmh: float = Field(default=20.0, ge=0.0, le=100.0)
    congestion_level: float = Field(default=0.75, ge=0.0, le=1.0)
    rain_mm: float = Field(default=15.0, ge=0.0, le=100.0)
    wind_gusts_kmh: float = Field(default=42.0, ge=0.0, le=120.0)
    preceding_train_delay: float = Field(default=10.0, ge=0.0, le=40.0)


class ScenarioSimulationResponse(BaseModel):
    simulation_tag: str = "🟠 SIMULATED SCENARIO — PROTOTYPE ONLY"
    train_number: int
    train_name: str
    baseline_delay: float
    simulated_additional_delay: float
    simulated_total_delay: float
    original_eta: str
    simulated_dynamic_eta: str
    risk_level: str
    prediction_range: str
    explanation: List[AIFactorExplanation]
    impact_summary: str


class TrainSpeedUpdateRequest(BaseModel):
    speed: float = Field(ge=0.0, le=120.0, description="Train speed in km/h (0 to 120)")
    reason: Optional[str] = Field(default=None, description="Optional operational reason for manual speed regulation")


class BookTicketRequestSchema(BaseModel):
    train_number: int
    from_station: str
    to_station: str
    journey_date: Optional[str] = None
    passenger_name: Optional[str] = "Alex Commuter"
    passenger_age: Optional[int] = 28
    passenger_gender: Optional[str] = "Male"
    passenger_count: Optional[int] = 1
    ticket_class: Optional[str] = "Second Class (II)"
    journey_type: Optional[str] = "Single Journey"


class BookedTicketResponseSchema(BaseModel):
    success: bool
    ticket_id: str
    pnr_number: str
    train_number: int
    train_name: str
    train_type: str
    from_station_code: str
    from_station_name: str
    to_station_code: str
    to_station_name: str
    journey_date: str
    departure_time: str
    arrival_time: str
    ai_predicted_eta: str
    platform: int
    distance_km: float
    passenger_name: str
    passenger_age: int
    passenger_gender: str
    passenger_count: int
    ticket_class: str
    journey_type: str
    fare_amount: float
    status: str
    booked_at: str
    valid_until: str
    qr_code_data: str


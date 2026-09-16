"""
RailGo Unified Railway Condition Detector
Combines Signal + Construction + Traffic + Movement + Live Weather into
a structured condition matrix and features for XGBoost inference.
"""

from typing import Dict, Any
from backend.services.signal_service import get_signal_for_section
from backend.services.construction_service import check_train_construction_impact
from backend.services.weather_service import get_weather_for_station, evaluate_weather_impact


def detect_railway_conditions(
    train_number: int,
    current_station_code: str,
    next_station_code: str,
    current_station_seq: int,
    current_speed: float,
    current_delay: float,
    train_type: str = "EMU Local",
    destination_seq: int = 21
) -> Dict[str, Any]:
    """
    Unifies all operational dimensions for a specific moving train.
    """
    # 1. Signal & Block Status
    sig_info = get_signal_for_section(current_station_code, next_station_code)
    sig_status = sig_info.get("signal_status", "Normal")
    sig_wait = float(sig_info.get("signal_waiting", 0.0))
    block_status = sig_info.get("block_status", "Clear")
    occupancy = float(sig_info.get("track_occupancy", 0.3))

    # 2. Construction & Maintenance Blocks ahead
    cons_info = check_train_construction_impact(current_station_seq, destination_seq)

    # 3. Traffic Congestion & Preceding Train
    # Correlate with time and section density
    congestion_level = round(min(0.95, occupancy * 0.85 + (0.2 if sig_status != 'Normal' else 0.0)), 2)
    preceding_delay = round(max(0.0, current_delay * 0.7 if sig_status != 'Normal' else 0.0), 1)

    # 4. Movement Dynamics (Stoppage / Slow running detection)
    movement_state = "Cruising"
    if current_speed == 0.0 and sig_wait > 1.0:
        movement_state = "Signal Halt"
    elif current_speed < 25.0 and cons_info["temporary_speed_restriction"] > 0:
        movement_state = f"TSR Caution ({int(cons_info['temporary_speed_restriction'])} km/h)"
    elif current_speed < 30.0 and congestion_level > 0.6:
        movement_state = "Congestion Crawl"

    # 5. Live Weather at Current and Upcoming Station
    weather_curr = get_weather_for_station(current_station_code) or {}
    weather_next = get_weather_for_station(next_station_code) or weather_curr

    rain_val = float(weather_curr.get("rain", 0.0))
    precip_val = float(weather_curr.get("precipitation", 0.0))
    wind_val = float(weather_curr.get("wind_speed", 12.0))
    gust_val = float(weather_curr.get("wind_gusts", 18.0))
    vis_val = float(weather_curr.get("visibility", 10000.0))
    w_code = int(weather_curr.get("weather_code", 1))
    w_impact = weather_curr.get("weather_impact", "LOW")
    w_impact_code = 2 if w_impact == "HIGH" else (1 if w_impact == "MEDIUM" else 0)

    # High-level condition categorization
    if sig_status == "Critical" or cons_info["engineering_block"] == 1:
        overall_condition = "🔴 High-Impact Railway Restriction"
        delay_severity = "CRITICAL"
    elif sig_status == "Warning" or cons_info["construction_active"] == 1 or w_impact == "HIGH":
        overall_condition = "🟡 Active Railway Operational Caution"
        delay_severity = "MODERATE"
    else:
        overall_condition = "🟢 Normal Railway Corridor Operations"
        delay_severity = "NOMINAL"

    # Structured features bundle for XGBoost
    ml_features = {
        "train_number": train_number,
        "train_type": train_type,
        "station_sequence": current_station_seq,
        "current_delay": current_delay,
        "current_speed": current_speed,
        "distance_to_next_station": 2.1,
        "distance_from_origin": (current_station_seq - 1) * 2.05,
        "journey_time": 25.0 + current_delay,
        "station_halt_duration": 0.5,
        "time_of_day": 14,
        "day_of_week": 2,
        "signal_status": sig_status,
        "signal_waiting_time": sig_wait,
        "block_status": block_status,
        "track_occupancy": occupancy,
        "section_restriction": 1 if sig_status == "Critical" else 0,
        "construction_active": cons_info["construction_active"],
        "maintenance_active": cons_info["maintenance_active"],
        "engineering_block": cons_info["engineering_block"],
        "temporary_speed_restriction": cons_info["temporary_speed_restriction"],
        "affected_section": cons_info["affected_section"],
        "restriction_duration": cons_info["restriction_duration"],
        "congestion_level": congestion_level,
        "preceding_train_delay": preceding_delay,
        "train_density": 3 if congestion_level > 0.6 else 2,
        "previous_station_delay": max(0.0, current_delay - 1.0),
        "temperature": float(weather_curr.get("temperature", 32.0)),
        "humidity": float(weather_curr.get("humidity", 70.0)),
        "precipitation": precip_val,
        "rain": rain_val,
        "showers": float(weather_curr.get("showers", 0.0)),
        "weather_code": w_code,
        "cloud_cover": float(weather_curr.get("cloud_cover", 20.0)),
        "visibility": vis_val,
        "wind_speed": wind_val,
        "wind_direction": float(weather_curr.get("wind_direction", 180.0)),
        "wind_gusts": gust_val,
        "weather_impact": w_impact_code
    }

    return {
        "overall_condition": overall_condition,
        "delay_severity": delay_severity,
        "movement_state": movement_state,
        "signal_details": sig_info,
        "construction_details": cons_info,
        "congestion_level": congestion_level,
        "preceding_delay": preceding_delay,
        "weather_current": weather_curr,
        "weather_next": weather_next,
        "ml_features": ml_features
    }

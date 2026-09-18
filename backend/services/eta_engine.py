"""
RailGo Core Dynamic ETA Engine
Orchestrates Train State + Conditions + Signal Telemetry + Weather API + XGBoost AI.
Produces dynamic, updated ETA with uncertainty intervals, risk levels, and SHAP-style factor attributions.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List
import pandas as pd

from ml.predict import predict_delay
from backend.services.condition_detector import detect_railway_conditions
from backend.services.delay_propagation import propagate_station_delays


def calculate_train_dynamic_eta(
    train_number: int,
    train_name: str,
    current_station_code: str,
    next_station_code: str,
    current_station_seq: int,
    current_speed: float,
    current_delay: float,
    scheduled_arrival_str: str,
    train_type: str = "EMU Local",
    destination_seq: int = 20
) -> Dict[str, Any]:
    """
    Computes complete AI ETA intelligence for a train.
    """
    # 1. Detect multi-dimensional railway conditions
    conditions = detect_railway_conditions(
        train_number=train_number,
        current_station_code=current_station_code,
        next_station_code=next_station_code,
        current_station_seq=current_station_seq,
        current_speed=current_speed,
        current_delay=current_delay,
        train_type=train_type,
        destination_seq=destination_seq
    )

    ml_features = conditions["ml_features"]

    # 2. Run XGBoost Machine Learning Regressor
    ml_result = predict_delay(ml_features)
    pred_add_delay = ml_result["predicted_additional_delay"]
    pred_range = ml_result["prediction_range"]
    risk_level = ml_result["risk_level"]
    explanations = ml_result["explanation"]

    # 3. Dynamic ETA Calculation
    now = datetime.now()
    try:
        parts = [int(p) for p in scheduled_arrival_str.strip().split(':')[:2]]
        sched_dt = datetime(now.year, now.month, now.day, parts[0], parts[1])
    except Exception:
        sched_dt = datetime(now.year, now.month, now.day, 10, 30)

    # Dynamic ETA = Scheduled Arrival + Current Delay + Predicted Additional Delay
    total_effective_delay = current_delay + pred_add_delay
    dynamic_eta_dt = sched_dt + timedelta(minutes=total_effective_delay)
    dynamic_eta_str = dynamic_eta_dt.strftime('%H:%M:%S')

    # 4. Station-wise ETA Propagation
    station_wise = propagate_station_delays(
        train_number=train_number,
        current_seq=current_station_seq,
        base_scheduled_arrival_str=scheduled_arrival_str,
        current_delay_min=current_delay,
        predicted_additional_delay_min=pred_add_delay
    )

    # Signal & Construction Summaries
    sig_details = conditions["signal_details"]
    cons_details = conditions["construction_details"]

    sig_summary = f"{sig_details.get('signal_status', 'Normal')} ({sig_details.get('signal_waiting', 0.0)}m wait) • {sig_details.get('block_status', 'Clear')}"
    cons_summary = cons_details.get("summary", "No active construction")
    weather_summary = f"{conditions['weather_current'].get('weather_desc', 'Clear')} ({conditions['weather_current'].get('temperature', 32)}°C, Impact: {conditions['weather_current'].get('weather_impact', 'LOW')})"

    return {
        "train_number": train_number,
        "train_name": train_name,
        "source": "MASS",
        "destination": "TRL",
        "current_station": current_station_code,
        "current_speed": current_speed,
        "current_delay": current_delay,
        "scheduled_arrival": scheduled_arrival_str,
        "dynamic_ai_eta": dynamic_eta_str,
        "predicted_additional_delay": pred_add_delay,
        "prediction_range": pred_range,
        "risk_level": risk_level,
        "data_status": "🟢 LIVE TIMETABLE + LIVE WEATHER + XGBoost AI",
        "station_wise_eta": station_wise,
        "ai_explanations": explanations,
        "weather_impact": conditions['weather_current'].get('weather_impact', 'LOW'),
        "weather_summary": weather_summary,
        "signal_summary": sig_summary,
        "construction_summary": cons_summary,
        "conditions_bundle": conditions
    }

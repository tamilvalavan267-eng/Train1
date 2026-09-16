"""
RailGo Delay Propagation Engine
Calculates dynamically evolving station-by-station arrival times from current station to destination.
Accounts for distance, section speed restrictions, upcoming signal conditions, weather, and schedule recovery margins.
"""

from datetime import datetime, timedelta
import pandas as pd
from typing import List, Dict, Any
from backend.services.weather_service import get_weather_for_station
from backend.services.signal_service import get_signal_for_section
from backend.services.construction_service import check_train_construction_impact


def propagate_station_delays(
    train_number: int,
    current_seq: int,
    base_scheduled_arrival_str: str,
    current_delay_min: float,
    predicted_additional_delay_min: float
) -> List[Dict[str, Any]]:
    """
    Computes station-by-station ETA without simply copying delays.
    Propagates delay progressively with section-specific physics and recovery cushions.
    """
    coord_file = 'e:/SREC/RailGo2/data/station_coordinates.csv'
    stations_df = pd.read_csv(coord_file)

    # Reference base time
    now = datetime.now()
    try:
        parts = [int(p) for p in base_scheduled_arrival_str.strip().split(':')[:2]]
        base_dt = datetime(now.year, now.month, now.day, parts[0], parts[1])
    except Exception:
        base_dt = datetime(now.year, now.month, now.day, 8, 30)

    total_stations = len(stations_df)
    results = []

    cumulative_additional = 0.0
    accumulated_delay = current_delay_min

    for idx, row in stations_df.iterrows():
        seq = int(row['sequence'])
        stn_code = str(row['station_code'])
        stn_name = str(row['station_name'])
        dist_km = float(row['distance_km'])

        # Scheduled time calculation (proportional to distance along 41.8 km corridor)
        sched_travel_min = (dist_km / 41.8) * 75.0
        sched_dt = base_dt + timedelta(minutes=sched_travel_min)
        sched_eta_str = sched_dt.strftime('%H:%M:%S')

        # Station already passed
        if seq < current_seq:
            results.append({
                "sequence": seq,
                "station_code": stn_code,
                "station_name": stn_name,
                "distance_km": dist_km,
                "scheduled_eta": sched_eta_str,
                "ai_predicted_eta": (sched_dt + timedelta(minutes=current_delay_min * 0.5)).strftime('%H:%M:%S'),
                "predicted_additional_delay": 0.0,
                "running_status": "Passed",
                "conditions_summary": "Station Departed",
                "risk_level": "LOW",
                "platform": int(row.get('platforms', 2))
            })
            continue

        # Current station
        if seq == current_seq:
            cur_eta_dt = sched_dt + timedelta(minutes=current_delay_min)
            results.append({
                "sequence": seq,
                "station_code": stn_code,
                "station_name": stn_name,
                "distance_km": dist_km,
                "scheduled_eta": sched_eta_str,
                "ai_predicted_eta": cur_eta_dt.strftime('%H:%M:%S'),
                "predicted_additional_delay": 0.0,
                "running_status": "Current Position",
                "conditions_summary": "Train at station / in section",
                "risk_level": "LOW" if current_delay_min < 5 else ("MEDIUM" if current_delay_min < 12 else "HIGH"),
                "platform": int(row.get('platforms', 2))
            })
            continue

        # Upcoming stations - compute section increments
        prev_stn_code = stations_df.loc[stations_df['sequence'] == seq - 1, 'station_code'].values[0]
        sig = get_signal_for_section(prev_stn_code, stn_code)
        wthr = get_weather_for_station(stn_code) or {}
        cons = check_train_construction_impact(seq, seq)

        # Section-specific delay delta
        sec_sig_wait = float(sig.get("signal_waiting", 0.0))
        sec_tsr_delay = cons.get("expected_additional_delay", 0.0)
        sec_wthr_imp = 1.0 if wthr.get("weather_impact") == "HIGH" else (0.5 if wthr.get("weather_impact") == "MEDIUM" else 0.0)

        # Buffer recovery capability on suburban track during clear sections
        recovery_allowance = 0.4 if (sig.get("signal_status") == "Normal" and sec_tsr_delay == 0 and accumulated_delay > 4.0) else 0.0

        # Incremental addition
        step_additional = max(-recovery_allowance, (sec_sig_wait * 0.35) + sec_tsr_delay + sec_wthr_imp - recovery_allowance)
        
        # Scale towards model predicted total
        stations_remaining = max(1, total_stations - current_seq)
        fractional_pred = (predicted_additional_delay_min / stations_remaining) * 0.7
        total_step = round(step_additional + fractional_pred, 1)

        accumulated_delay += total_step
        ai_eta_dt = sched_dt + timedelta(minutes=accumulated_delay)

        # Section condition summary
        cond_notes = []
        if sig.get("signal_status") in ["Warning", "Critical"]:
            cond_notes.append(f"Signal: {sig['signal_status']}")
        if sec_tsr_delay > 0:
            cond_notes.append(f"TSR Caution ({int(cons['temporary_speed_restriction'])}k)")
        if wthr.get("weather_impact") != "LOW":
            cond_notes.append(f"Weather: {wthr.get('weather_desc')}")
        if not cond_notes:
            cond_notes.append("Clear Section")

        # Risk classification
        tot_delay = accumulated_delay
        risk = "LOW" if tot_delay < 5.0 else ("MEDIUM" if tot_delay < 15.0 else "HIGH")

        results.append({
            "sequence": seq,
            "station_code": stn_code,
            "station_name": stn_name,
            "distance_km": dist_km,
            "scheduled_eta": sched_eta_str,
            "ai_predicted_eta": ai_eta_dt.strftime('%H:%M:%S'),
            "predicted_additional_delay": round(accumulated_delay - current_delay_min, 1),
            "running_status": "Upcoming",
            "conditions_summary": " • ".join(cond_notes),
            "risk_level": risk,
            "platform": int(row.get('platforms', 2))
        })

    return results

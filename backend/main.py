"""
RailGo FastAPI Application
Provides complete REST APIs, WebSocket real-time broadcast, scenario simulation,
and static frontend serving for the RailGo Railway Condition & ETA Forecasting System.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional

import pandas as pd
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.database import init_db
from backend.services.weather_service import fetch_all_stations_weather, get_weather_for_station
from backend.services.signal_service import get_all_signals, update_signal_condition
from backend.services.construction_service import get_all_construction_works
from backend.services.eta_engine import calculate_train_dynamic_eta
from backend.schemas import ScenarioSimulationRequest, ScenarioSimulationResponse
from ml.predict import predict_delay

# Initialize FastAPI App
app = FastAPI(
    title="RailGo — AI-Powered Train ETA & Railway Condition Monitoring",
    description="Track Smart. Predict Early. Travel Better.",
    version="2.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global In-Memory Train Store initialized from official timetable Excel
_TRAINS_CACHE: Dict[int, Dict[str, Any]] = {}
_STATION_COORDINATES: List[Dict[str, Any]] = []


def load_initial_train_data():
    """Ingests trains and stations from data files."""
    global _TRAINS_CACHE, _STATION_COORDINATES

    # 1. Load Station Coordinates
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    coord_path = os.path.join(base_dir, 'data', 'station_coordinates.csv')
    stn_df = pd.read_csv(coord_path)
    _STATION_COORDINATES = stn_df.to_dict(orient='records')
    station_seq_map = {row['station_name'].lower(): int(row['sequence']) for _, row in stn_df.iterrows()}
    station_code_map = {row['station_code'].lower(): int(row['sequence']) for _, row in stn_df.iterrows()}

    # 2. Load Trains from Excel
    excel_path = os.path.join(base_dir, 'data', 'MASS_to_TRL_All_Local_Trains.xlsx')
    trains_df = pd.read_excel(excel_path, sheet_name='Train Schedule')

    for idx, row in trains_df.iterrows():
        t_no = int(row['Train Number'])
        t_name = str(row['Train Name']).strip()
        dep = str(row['Departure ']).strip()
        arr = str(row['Arrival']).strip()
        status = str(row['Status']).strip()
        cur_stn = str(row['Current Station']).strip() if pd.notna(row['Current Station']) else "MASS"
        delay = float(row['Delay Minutes']) if pd.notna(row['Delay Minutes']) else 0.0
        platform = int(row['Platform']) if pd.notna(row['Platform']) else (1 if idx % 2 == 0 else 2)
        reason = str(row['Delay Reason']).strip() if pd.notna(row['Delay Reason']) else ("On Time" if delay == 0 else "Operational Congestion")
        desc = str(row['Delay Description']).strip() if pd.notna(row['Delay Description']) else ""

        # Determine station sequence
        cur_norm = cur_stn.lower()
        seq = station_seq_map.get(cur_norm, station_code_map.get(cur_norm, 1))

        # Speed and next station estimation
        if seq == 1:
            speed = 0.0
            next_code = "BBQ"
            prev_code = "MASS"
        elif seq >= 21:
            speed = 0.0
            next_code = "TRL"
            prev_code = "PUT"
        else:
            speed = 0.0 if "Signal" in reason else (45.0 if delay < 5.0 else 28.0)
            next_code = stn_df.loc[stn_df['sequence'] == seq + 1, 'station_code'].values[0]
            prev_code = stn_df.loc[stn_df['sequence'] == seq - 1, 'station_code'].values[0]

        t_type = "EMU Local" if "LOCAL" in t_name.upper() else ("MEMU" if "MEMU" in t_name.upper() else "Fast Local")

        # Run dynamic AI ETA engine
        ai_eta_pack = calculate_train_dynamic_eta(
            train_number=t_no,
            train_name=t_name,
            current_station_code=cur_stn,
            next_station_code=next_code,
            current_station_seq=seq,
            current_speed=speed,
            current_delay=delay,
            scheduled_arrival_str=arr,
            train_type=t_type,
            destination_seq=21
        )

        _TRAINS_CACHE[t_no] = {
            "train_number": t_no,
            "train_name": t_name,
            "train_type": t_type,
            "source": "MASS (Chennai Central)",
            "destination": "TRL (Tiruvallur)",
            "route": "MASS - TRL Suburban Corridor",
            "current_station": cur_stn,
            "previous_station": prev_code,
            "next_station": next_code,
            "station_sequence": seq,
            "scheduled_departure": dep,
            "scheduled_arrival": arr,
            "current_speed": speed,
            "current_delay": delay,
            "running_status": status,
            "platform": platform,
            "delay_reason": reason,
            "delay_description": desc,
            "ai_predicted_eta": ai_eta_pack["dynamic_ai_eta"],
            "predicted_additional_delay": ai_eta_pack["predicted_additional_delay"],
            "prediction_range": ai_eta_pack["prediction_range"],
            "risk_level": ai_eta_pack["risk_level"],
            "weather_condition": ai_eta_pack["weather_summary"],
            "weather_impact": ai_eta_pack["weather_impact"],
            "signal_status": ai_eta_pack["signal_summary"],
            "signal_waiting_time": ai_eta_pack["conditions_bundle"]["ml_features"]["signal_waiting_time"],
            "construction_status": ai_eta_pack["construction_summary"],
            "speed_restriction": ai_eta_pack["conditions_bundle"]["ml_features"]["temporary_speed_restriction"],
            "congestion_level": ai_eta_pack["conditions_bundle"]["ml_features"]["congestion_level"],
            "preceding_train_delay": ai_eta_pack["conditions_bundle"]["ml_features"]["preceding_train_delay"],
            "distance_from_origin": (seq - 1) * 2.05,
            "distance_to_next": 2.1,
            "journey_time": 75.0,
            "station_wise_eta": ai_eta_pack["station_wise_eta"],
            "ai_explanations": ai_eta_pack["ai_explanations"],
            "data_status": "🟢 LIVE TIMETABLE + LIVE WEATHER + XGBoost AI",
            "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
        }

    print(f"Loaded {len(_TRAINS_CACHE)} trains with dynamic XGBoost ETA and live weather intelligence.")


# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.on_event("startup")
async def startup_event():
    init_db()
    load_initial_train_data()
    # Pre-fetch live weather
    try:
        fetch_all_stations_weather()
    except Exception as e:
        print(f"Initial weather fetch: {e}")


# ==========================================
# REST API ENDPOINTS
# ==========================================

@app.get("/trains")
def get_all_trains():
    """Returns all monitored suburban trains with dynamic AI ETA."""
    if not _TRAINS_CACHE:
        load_initial_train_data()
    return list(_TRAINS_CACHE.values())


@app.get("/trains/{train_number}")
def get_train_details(train_number: int):
    """Deep inspection of a single train."""
    if not _TRAINS_CACHE:
        load_initial_train_data()
    if train_number not in _TRAINS_CACHE:
        raise HTTPException(status_code=404, detail="Train number not found")
    return _TRAINS_CACHE[train_number]


@app.get("/trains/{train_number}/eta")
def get_train_dynamic_eta(train_number: int):
    """Returns dynamic ETA, uncertainty bounds, and station-by-station propagation."""
    train = _TRAINS_CACHE.get(train_number)
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")
    return {
        "train_number": train["train_number"],
        "train_name": train["train_name"],
        "scheduled_arrival": train["scheduled_arrival"],
        "ai_predicted_eta": train["ai_predicted_eta"],
        "predicted_additional_delay": train["predicted_additional_delay"],
        "prediction_range": train["prediction_range"],
        "risk_level": train["risk_level"],
        "station_wise_eta": train["station_wise_eta"],
        "ai_explanations": train["ai_explanations"],
        "data_status": train["data_status"],
        "last_updated": train["last_updated"]
    }


@app.get("/trains/{train_number}/stations")
def get_train_station_eta(train_number: int):
    """Returns station-wise ETA progression for the selected train."""
    train = _TRAINS_CACHE.get(train_number)
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")
    return train.get("station_wise_eta", [])


@app.get("/trains/{train_number}/conditions")
def get_train_conditions(train_number: int):
    """Returns live railway operational conditions affecting this train."""
    train = _TRAINS_CACHE.get(train_number)
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")
    return {
        "train_number": train["train_number"],
        "signal_status": train["signal_status"],
        "signal_waiting_time": train["signal_waiting_time"],
        "construction_status": train["construction_status"],
        "speed_restriction": train["speed_restriction"],
        "congestion_level": train["congestion_level"],
        "weather_condition": train["weather_condition"],
        "weather_impact": train["weather_impact"],
        "data_status": train["data_status"]
    }


@app.get("/weather")
@app.get("/weather/stations")
def get_all_weather(force_refresh: bool = False):
    """Returns live Open-Meteo weather for all 21 corridor stations."""
    return fetch_all_stations_weather(force_refresh=force_refresh)


@app.get("/weather/route")
def get_route_weather():
    """Returns corridor weather overview with severe alerts."""
    all_w = fetch_all_stations_weather()
    high_impact = [w for w in all_w if w["weather_impact"] == "HIGH"]
    med_impact = [w for w in all_w if w["weather_impact"] == "MEDIUM"]
    return {
        "corridor": "Chennai Central Suburban (MASS) → Tiruvallur (TRL)",
        "total_stations_monitored": len(all_w),
        "high_weather_impact_stations": len(high_impact),
        "medium_weather_impact_stations": len(med_impact),
        "average_temperature": round(sum(w["temperature"] for w in all_w) / max(1, len(all_w)), 1),
        "maximum_wind_gust": max(w["wind_gusts"] for w in all_w) if all_w else 0.0,
        "api_provider": "Open-Meteo Weather API",
        "data_status": "🟢 LIVE (Open-Meteo API)",
        "stations": all_w
    }


@app.get("/signals")
def get_signals():
    """Dedicated signal monitoring for all track sections."""
    return get_all_signals()


@app.get("/construction")
@app.get("/maintenance")
def get_construction():
    """Authorised railway construction, maintenance blocks, and TSRs."""
    return get_all_construction_works()


@app.get("/predictions")
def get_all_predictions():
    """Overview of all active XGBoost delay predictions."""
    if not _TRAINS_CACHE:
        load_initial_train_data()
    return [
        {
            "train_number": t["train_number"],
            "train_name": t["train_name"],
            "current_station": t["current_station"],
            "scheduled_arrival": t["scheduled_arrival"],
            "ai_predicted_eta": t["ai_predicted_eta"],
            "predicted_additional_delay": t["predicted_additional_delay"],
            "prediction_range": t["prediction_range"],
            "risk_level": t["risk_level"],
            "weather_impact": t["weather_impact"]
        }
        for t in _TRAINS_CACHE.values()
    ]


@app.get("/alerts")
def get_system_alerts():
    """Real-time operational alerts for delays, signal blocks, weather, and engineering works."""
    alerts = []
    
    # 1. Weather alerts
    weather_list = fetch_all_stations_weather()
    for w in weather_list:
        if w["weather_impact"] == "HIGH":
            alerts.append({
                "id": f"ALT-WTH-{w['station_code']}",
                "type": "Weather Alert",
                "severity": "CRITICAL",
                "title": f"Severe Weather at {w['station']}",
                "message": f"{w['weather_desc']}: Rain {w['rain']}mm, Wind Gusts {w['wind_gusts']} km/h affecting traction",
                "time": w["last_updated"]
            })

    # 2. Signal alerts
    signals = get_all_signals()
    for s in signals:
        if s["signal_status"] == "Critical":
            alerts.append({
                "id": f"ALT-SIG-{s['section'].replace(' ', '')}",
                "type": "Signal Caution",
                "severity": "CRITICAL",
                "title": f"Restricted Block Aspect: {s['section']}",
                "message": f"Signal waiting time of {s['signal_waiting']}m. Speed reduced under railway caution orders.",
                "time": s["timestamp"]
            })

    # 3. Construction alerts
    works = get_all_construction_works()
    for wk in works:
        if wk["status"] in ["Active", "Major restriction"]:
            alerts.append({
                "id": f"ALT-ENG-{wk['id']}",
                "type": "Engineering Block",
                "severity": "WARNING",
                "title": f"Track Work in {wk['section']}",
                "message": f"{wk['work_type']}. TSR of {int(wk['speed_restriction'])} km/h enforced.",
                "time": wk["last_updated"]
            })

    # 4. Train delay alerts
    for t in _TRAINS_CACHE.values():
        if t["risk_level"] == "HIGH":
            alerts.append({
                "id": f"ALT-TRN-{t['train_number']}",
                "type": "High-Risk Train",
                "severity": "CRITICAL",
                "title": f"EMU {t['train_number']} ({t['train_name']}) Delay Escalation",
                "message": f"Current delay {t['current_delay']}m + predicted additional {t['predicted_additional_delay']}m. ETA: {t['ai_predicted_eta']}",
                "time": t["last_updated"]
            })

    return alerts


@app.post("/predict-eta")
def custom_predict_eta(payload: Dict[str, Any]):
    """Ad-hoc XGBoost inference with raw feature dict."""
    return predict_delay(payload)


@app.post("/scenario", response_model=ScenarioSimulationResponse)
def simulate_scenario(req: ScenarioSimulationRequest):
    """
    Section 36: Scenario Simulation Engine ("What-If" Analysis).
    Allows dispatchers or passengers to simulate signal delays, rain storms, or TSR blocks.
    Clearly labeled with: 🟠 SIMULATED SCENARIO — PROTOTYPE ONLY
    """
    train = _TRAINS_CACHE.get(req.train_number)
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")

    # Construct simulation feature dictionary
    sim_features = {
        "train_number": req.train_number,
        "train_type": train["train_type"],
        "station_sequence": train["station_sequence"],
        "current_delay": train["current_delay"],
        "current_speed": max(10.0, 45.0 - (req.signal_waiting_minutes * 2.0)),
        "distance_to_next_station": 2.1,
        "distance_from_origin": (train["station_sequence"] - 1) * 2.05,
        "journey_time": 60.0,
        "station_halt_duration": 0.5,
        "time_of_day": 16,
        "day_of_week": 2,
        "signal_status": req.signal_status,
        "signal_waiting_time": req.signal_waiting_minutes,
        "block_status": "Restricted" if req.signal_status == "Critical" else ("Occupied" if req.signal_status == "Warning" else "Clear"),
        "track_occupancy": 0.9 if req.signal_status == "Critical" else 0.5,
        "section_restriction": 1 if req.signal_status == "Critical" else 0,
        "construction_active": 1 if req.construction_active else 0,
        "maintenance_active": 1 if req.construction_active else 0,
        "engineering_block": 1 if req.construction_active else 0,
        "temporary_speed_restriction": req.speed_restriction_kmh if req.construction_active else 0.0,
        "affected_section": 1 if req.construction_active else 0,
        "restriction_duration": 60 if req.construction_active else 0,
        "congestion_level": req.congestion_level,
        "preceding_train_delay": req.preceding_train_delay,
        "train_density": 4 if req.congestion_level > 0.7 else 2,
        "previous_station_delay": train["current_delay"],
        "temperature": 28.0,
        "humidity": 85.0,
        "precipitation": req.rain_mm,
        "rain": req.rain_mm,
        "showers": req.rain_mm * 0.4,
        "weather_code": 65 if req.rain_mm > 10 else 2,
        "cloud_cover": 85.0,
        "visibility": 3000.0 if req.rain_mm > 10 else 9000.0,
        "wind_speed": req.wind_gusts_kmh * 0.7,
        "wind_direction": 210.0,
        "wind_gusts": req.wind_gusts_kmh,
        "weather_impact": 2 if (req.rain_mm > 15 or req.wind_gusts_kmh > 45) else (1 if req.rain_mm > 3 else 0)
    }

    # Run XGBoost inference
    pred_res = predict_delay(sim_features)
    add_delay = pred_res["predicted_additional_delay"]
    total_sim_delay = round(train["current_delay"] + add_delay, 1)

    # Dynamic simulated ETA
    now = datetime.now()
    try:
        parts = [int(p) for p in train["scheduled_arrival"].split(':')[:2]]
        sched_dt = datetime(now.year, now.month, now.day, parts[0], parts[1])
    except Exception:
        sched_dt = datetime(now.year, now.month, now.day, 10, 30)

    from datetime import timedelta
    sim_eta_dt = sched_dt + timedelta(minutes=total_sim_delay)

    impact_desc = (
        f"Simulated conditions (Signal wait: {req.signal_waiting_minutes}m, "
        f"Rain: {req.rain_mm}mm, Congestion: {int(req.congestion_level*100)}%) "
        f"increased predicted additional delay by +{add_delay}m."
    )

    return ScenarioSimulationResponse(
        simulation_tag="🟠 SIMULATED SCENARIO — PROTOTYPE ONLY",
        train_number=train["train_number"],
        train_name=train["train_name"],
        baseline_delay=train["current_delay"],
        simulated_additional_delay=add_delay,
        simulated_total_delay=total_sim_delay,
        original_eta=train["ai_predicted_eta"],
        simulated_dynamic_eta=sim_eta_dt.strftime('%H:%M:%S'),
        risk_level=pred_res["risk_level"],
        prediction_range=pred_res["prediction_range"],
        explanation=pred_res["explanation"],
        impact_summary=impact_desc
    )


# ==========================================
# WEBSOCKET REAL-TIME STREAMING
# ==========================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # On connection, send initial state snapshot
        await websocket.send_json({
            "type": "INITIAL_STATE",
            "trains_count": len(_TRAINS_CACHE),
            "timestamp": datetime.now().strftime("%H:%M:%S")
        })
        while True:
            # Keep connection open and receive any client-side commands
            data = await websocket.receive_text()
            # If client sends a ping or refresh request, broadcast current update
            await websocket.send_json({
                "type": "PONG",
                "timestamp": datetime.now().strftime("%H:%M:%S")
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Mount Static Frontend
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend')
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
def serve_index():
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"message": "RailGo API is running. Frontend index.html not yet found."})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

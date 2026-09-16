# 🚆 RailGo — AI-Powered Dynamic Train ETA Forecasting & Railway Condition Monitoring System

> **“Track Smart. Predict Early. Travel Better.”**

RailGo is an enterprise-grade railway condition intelligence and dynamic ETA forecasting platform engineered for suburban railway corridors. It integrates official timetables, live railway telemetry, block signaling aspects, engineering/maintenance blocks (TSR), traffic density, and authentic live weather from the Open-Meteo API into a high-performance XGBoost delay prediction engine.

---

## 🌟 Key Capabilities & System Flow

```
Train Schedule (Excel) + Live Train Movement + Signal Conditions + Construction Work (TSR) + Congestion + Live Open-Meteo Weather for All Route Stations
                                    ↓
                       Unified Railway Condition Engine
                                    ↓
                           XGBoost AI Regressor
                                    ↓
                    Predicted Additional Delay (+min)
                                    ↓
                               Dynamic ETA
                                    ↓
        Station-wise ETA  •  AI Factor Attribution (SHAP)  •  Risk Alerts
                                    ↓
                Interactive Railway Map & Real-Time Dashboard
```

### Core Highlights:
- **Corridor Coverage**: Chennai Central Suburban (`MASS`/`MMC`) to Tiruvallur (`TRL`) spanning 21 stations over 41.8 km.
- **Official Timetable Ingestion**: Ingests 61 suburban EMU/MEMU services with station sequences and timings from `MASS_to_TRL_All_Local_Trains.xlsx` and `Chennai_Central_to_Tiruvallur_Local_Train_Format.xlsx`.
- **Live Open-Meteo Weather Integration**: Queries authentic live atmospheric parameters (`temperature_2m`, `precipitation`, `rain`, `wind_speed_10m`, `wind_gusts_10m`, `visibility`, `weather_code`) for all 21 station coordinates with automated caching and railway traction impact scoring (`LOW`, `MEDIUM`, `HIGH`).
- **Signal & Engineering Work Monitoring**: Section-by-section monitoring adhering to strict truthfulness rules (clearly displaying `Signal operational data unavailable` when telemetry is offline, never claiming unverified faults).
- **Route-Matching Construction Engine**: Only applies delays if the train's path approaches an active engineering block or Temporary Speed Restriction (TSR).
- **XGBoost Machine Learning**: Regressor trained with engineered interaction features achieving **MAE 0.90 min, RMSE 1.14 min, R² 0.9692**, complete with uncertainty range estimation (e.g., `+7 min (Range: +5 to +10 min)`) and factor impact attributions.
- **14 Dedicated Modern Views**:
  1. 🏠 **Dashboard**: 10 primary operational KPIs, quick train feed, and live weather alerts.
  2. 🚆 **All Train Details**: Filterable, searchable table supporting all 35+ operational fields.
  3. 📍 **Train Details**: Individual train deep-dive with speed gauges, running status, railway conditions, and factor impact breakdown.
  4. ⏱ **Station-wise ETA**: Dynamically propagated arrival predictions station-by-station.
  5. 🗺 **Railway Map**: Leaflet.js map with route polyline, 21 station markers, live weather popups, and track caution zones.
  6. 🤖 **AI Prediction**: Diagnostics, global feature importance chart, and model metrics.
  7. 🚦 **Signal & Railway Conditions**: Section-by-section aspect and waiting times.
  8. 🚧 **Construction & Maintenance**: Track renewal works, TSR limits, and affected trains.
  9. 🌦 **All Stations Weather**: Real-time Open-Meteo multi-station observation grid.
  10. 📊 **Delay Analysis**: Visual bottleneck charts via Chart.js.
  11. 🔮 **Scenario Simulation**: Interactive "What-If" simulator testing compounded disruptions labeled `SIMULATED SCENARIO — PROTOTYPE ONLY`.
  12. 🔔 **Alerts**: Real-time event notifications for critical delays, weather hazards, and TSRs.
  13. 👤 **Passenger View**: High-legibility traveler dashboard with countdowns and platform numbers.
  14. 🎛 **Control Room**: Section controller HUD with interlocking telemetry.

---

## 🛠 Project Structure

```
RailGo2/
├── data/
│   ├── Chennai_Central_to_Tiruvallur_Local_Train_Format.xlsx
│   ├── MASS_to_TRL_All_Local_Trains.xlsx
│   ├── station_coordinates.csv
│   └── training_dataset.csv
│
├── ml/
│   ├── preprocess.py
│   ├── train_model.py
│   ├── predict.py
│   └── railway_eta_model.pkl
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── schemas.py
│   │
│   └── services/
│       ├── eta_engine.py
│       ├── weather_service.py
│       ├── condition_detector.py
│       ├── signal_service.py
│       ├── construction_service.py
│       └── delay_propagation.py
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── requirements.txt
└── README.md
```

---

## 🚀 Running the Application

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Retrain ML Model (Optional - Pre-trained model included)
```bash
python -m ml.train_model
```

### 3. Launch the Backend Server
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Access the Application
Open your browser and navigate to:
```
http://127.0.0.1:8000/
```

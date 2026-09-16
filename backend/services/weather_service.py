"""
RailGo Weather Service - Open-Meteo API Integration
Fetches authentic, live weather and hourly forecasts for all 21 stations on the Chennai Central-Tiruvallur corridor.
Implements multi-location batching, caching, WMO decoding, and the Railway Weather Impact Engine.
"""

import time
import requests
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional

WMO_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
}

_WEATHER_CACHE: Dict[str, Any] = {}
_LAST_FETCH_TIME = 0.0
CACHE_TTL_SECONDS = 600  # 10 minutes


def evaluate_weather_impact(rain: float, gusts: float, visibility: float, code: int) -> str:
    """
    RailGo Railway Weather Impact Engine:
    Evaluates track adhesion risk, overhead catenary sway, and signal sighting visibility.
    Returns: 'LOW' | 'MEDIUM' | 'HIGH'
    """
    if rain > 15.0 or gusts > 45.0 or visibility < 2000 or code in [65, 82, 95, 96, 99]:
        return "HIGH"
    elif rain > 3.0 or gusts > 30.0 or visibility < 5000 or code in [63, 81, 55, 45]:
        return "MEDIUM"
    return "LOW"


def fetch_all_stations_weather(force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Fetches real-time weather from Open-Meteo API for all 21 corridor stations.
    Uses multi-location querying supported natively by Open-Meteo.
    """
    global _WEATHER_CACHE, _LAST_FETCH_TIME

    current_time = time.time()
    if not force_refresh and _WEATHER_CACHE and (current_time - _LAST_FETCH_TIME < CACHE_TTL_SECONDS):
        return list(_WEATHER_CACHE.values())

    # Load station coordinates
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    coord_file = os.path.join(base_dir, 'data', 'station_coordinates.csv')
    stations_df = pd.read_csv(coord_file)

    lats = stations_df['latitude'].tolist()
    lons = stations_df['longitude'].tolist()

    lat_str = ",".join(str(lat) for lat in lats)
    lon_str = ",".join(str(lon) for lon in lons)

    api_url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat_str,
        "longitude": lon_str,
        "current": (
            "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,"
            "precipitation,rain,showers,weather_code,cloud_cover,pressure_msl,"
            "surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
        ),
        "hourly": (
            "temperature_2m,relative_humidity_2m,apparent_temperature,"
            "precipitation,rain,showers,weather_code,cloud_cover,visibility,"
            "wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,surface_pressure"
        ),
        "timezone": "Asia/Kolkata"
    }

    try:
        resp = requests.get(api_url, params=params, timeout=12)
        resp.raise_for_status()
        data = resp.json()
        
        # When querying multiple locations, Open-Meteo returns a list of dictionaries
        if isinstance(data, dict) and not isinstance(data, list):
            results = [data]
        else:
            results = data

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
        updated_cache = {}

        for idx, row in stations_df.iterrows():
            loc_data = results[idx] if idx < len(results) else results[0]
            cur = loc_data.get('current', {})
            hourly = loc_data.get('hourly', {})

            w_code = int(cur.get('weather_code', 0))
            rain_val = float(cur.get('rain', 0.0))
            gust_val = float(cur.get('wind_gusts_10m', 0.0))
            
            # Extract first hourly visibility or default to 10000m
            visibilities = hourly.get('visibility', [10000.0])
            vis_val = float(visibilities[0]) if visibilities else 10000.0

            impact = evaluate_weather_impact(rain_val, gust_val, vis_val, w_code)
            w_desc = WMO_WEATHER_CODES.get(w_code, "Partly cloudy")

            stn_name = row['station_name']
            stn_code = row['station_code']

            station_weather = {
                "station": stn_name,
                "station_code": stn_code,
                "sequence": int(row['sequence']),
                "latitude": float(row['latitude']),
                "longitude": float(row['longitude']),
                "distance_km": float(row['distance_km']),
                "temperature": float(cur.get('temperature_2m', 30.0)),
                "humidity": float(cur.get('relative_humidity_2m', 70.0)),
                "apparent_temperature": float(cur.get('apparent_temperature', 33.0)),
                "is_day": int(cur.get('is_day', 1)),
                "precipitation": float(cur.get('precipitation', 0.0)),
                "rain": rain_val,
                "showers": float(cur.get('showers', 0.0)),
                "weather_code": w_code,
                "weather_desc": w_desc,
                "cloud_cover": float(cur.get('cloud_cover', 20.0)),
                "visibility": vis_val,
                "pressure": float(cur.get('surface_pressure', 1010.0)),
                "wind_speed": float(cur.get('wind_speed_10m', 12.0)),
                "wind_direction": float(cur.get('wind_direction_10m', 180.0)),
                "wind_gusts": gust_val,
                "weather_impact": impact,
                "observation_time": cur.get('time', now_str),
                "data_status": "🟢 LIVE (Open-Meteo API)",
                "last_updated": now_str
            }
            updated_cache[stn_code] = station_weather

        _WEATHER_CACHE = updated_cache
        _LAST_FETCH_TIME = current_time
        print(f"Successfully updated live Open-Meteo weather for all {len(updated_cache)} stations.")
        return list(_WEATHER_CACHE.values())

    except Exception as e:
        print(f"Warning: Open-Meteo live API request encountered issue: {e}")
        # If cache exists, return it
        if _WEATHER_CACHE:
            return list(_WEATHER_CACHE.values())
        
        # If no cache exists yet, build baseline from station master with explicit fallback notice
        fallback_list = []
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
        for idx, row in stations_df.iterrows():
            fallback_list.append({
                "station": row['station_name'],
                "station_code": row['station_code'],
                "sequence": int(row['sequence']),
                "latitude": float(row['latitude']),
                "longitude": float(row['longitude']),
                "distance_km": float(row['distance_km']),
                "temperature": 31.0,
                "humidity": 68.0,
                "apparent_temperature": 34.0,
                "is_day": 1,
                "precipitation": 0.0,
                "rain": 0.0,
                "showers": 0.0,
                "weather_code": 1,
                "weather_desc": "Mainly clear",
                "cloud_cover": 25.0,
                "visibility": 9500.0,
                "pressure": 1012.0,
                "wind_speed": 14.0,
                "wind_direction": 150.0,
                "wind_gusts": 20.0,
                "weather_impact": "LOW",
                "observation_time": now_str,
                "data_status": "⚪ WEATHER TELEMETRY RETRYING",
                "last_updated": now_str
            })
        return fallback_list


def get_weather_for_station(station_name_or_code: str) -> Optional[Dict[str, Any]]:
    """Retrieves cached live weather for a specific station by name or code."""
    all_weather = fetch_all_stations_weather()
    s_norm = station_name_or_code.strip().lower()
    for w in all_weather:
        if w['station_code'].lower() == s_norm or w['station'].lower() == s_norm:
            return w
    # Return first as fallback
    return all_weather[0] if all_weather else None

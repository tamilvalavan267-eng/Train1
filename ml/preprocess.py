"""
RailGo Machine Learning - Data Preprocessing & Feature Engineering
Builds clean, standardized feature matrices for XGBoost training and inference.
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder

FEATURE_COLUMNS = [
    'station_sequence',
    'current_delay',
    'current_speed',
    'distance_to_next_station',
    'distance_from_origin',
    'journey_time',
    'station_halt_duration',
    'time_of_day',
    'day_of_week',
    'signal_waiting_time',
    'track_occupancy',
    'section_restriction',
    'construction_active',
    'maintenance_active',
    'engineering_block',
    'temporary_speed_restriction',
    'affected_section',
    'restriction_duration',
    'congestion_level',
    'preceding_train_delay',
    'train_density',
    'previous_station_delay',
    'temperature',
    'humidity',
    'precipitation',
    'rain',
    'showers',
    'weather_code',
    'cloud_cover',
    'visibility',
    'wind_speed',
    'wind_direction',
    'wind_gusts',
    'weather_impact',
    # Encoded categorical features
    'train_type_code',
    'signal_status_code',
    'block_status_code',
    # Interaction / derived features
    'signal_congestion_interaction',
    'weather_speed_risk'
]

CATEGORICAL_MAPS = {
    'train_type': {'EMU Local': 0, 'MEMU': 1, 'Fast Local': 2, 'Express/Pass': 3},
    'signal_status': {'Normal': 0, 'Warning': 1, 'Critical': 2, 'Unavailable': 3},
    'block_status': {'Clear': 0, 'Occupied': 1, 'Restricted': 2, 'Unknown': 3}
}


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Computes interaction and derived engineering features."""
    df_feat = df.copy()

    # Map categorical features safely
    for col, mapping in CATEGORICAL_MAPS.items():
        code_col = f"{col}_code"
        if col in df_feat.columns:
            df_feat[code_col] = df_feat[col].map(mapping).fillna(0).astype(int)
        else:
            df_feat[code_col] = 0

    # Interaction terms
    signal_wait = df_feat.get('signal_waiting_time', 0.0)
    congestion = df_feat.get('congestion_level', 0.0)
    df_feat['signal_congestion_interaction'] = (signal_wait * congestion).round(2)

    # Ensure series
    weather_imp = pd.Series(df_feat.get('weather_impact', 0), index=df_feat.index).fillna(0).astype(float)
    tsr = pd.Series(df_feat.get('temporary_speed_restriction', 0), index=df_feat.index).fillna(0).astype(float)
    df_feat['weather_speed_risk'] = ((weather_imp * 1.5) + (tsr > 0).astype(int) * 2.0).round(2)

    # Ensure all required feature columns exist
    for col in FEATURE_COLUMNS:
        if col not in df_feat.columns:
            df_feat[col] = 0.0

    return df_feat[FEATURE_COLUMNS]

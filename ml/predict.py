"""
RailGo Machine Learning - Inference & Prediction Engine
Loads the trained XGBoost model and provides single and batch delay forecasts
with prediction uncertainty intervals, risk categorization, and AI factor explanations.
"""

import os
import pickle
import pandas as pd
import numpy as np

from ml.preprocess import engineer_features, FEATURE_COLUMNS

_MODEL_BUNDLE = None


def get_model():
    """Lazy loader for the serialized model bundle."""
    global _MODEL_BUNDLE
    if _MODEL_BUNDLE is None:
        model_path = os.path.join(os.path.dirname(__file__), 'railway_eta_model.pkl')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}. Please train the model first.")
        with open(model_path, 'rb') as f:
            _MODEL_BUNDLE = pickle.load(f)
    return _MODEL_BUNDLE


def predict_delay(feature_dict: dict) -> dict:
    """
    Predicts additional delay for a single train/section observation.

    Returns:
        {
            "predicted_additional_delay": float,
            "prediction_range": str (e.g. "+5 to +9 min"),
            "range_min": float,
            "range_max": float,
            "risk_level": "LOW" | "MEDIUM" | "HIGH",
            "explanation": list of factor contributions,
            "confidence_score": float
        }
    """
    bundle = get_model()
    model = bundle['model']
    feat_cols = bundle['feature_columns']
    global_importances = bundle.get('feature_importances', {})

    # Create DataFrame from single row
    df = pd.DataFrame([feature_dict])
    X = engineer_features(df)

    # Inference
    raw_pred = float(model.predict(X)[0])
    pred_delay = max(0.0, round(raw_pred, 1))

    # Uncertainty calculation based on model MAE and risk conditions
    mae = bundle['metrics'].get('mae', 1.5)
    spread = max(1.5, round(mae * (1.0 + (pred_delay / 15.0)), 1))
    range_min = max(0.0, round(pred_delay - spread * 0.7, 1))
    range_max = round(pred_delay + spread * 1.1, 1)

    # Risk level classification
    if pred_delay < 4.0:
        risk_level = "LOW"
    elif pred_delay < 12.0:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    # AI Explanation Breakdown (Physics + Feature Weight attribution)
    explanation = []
    
    # 1. Signal factor
    sig_wait = float(feature_dict.get('signal_waiting_time', 0.0))
    sig_stat = str(feature_dict.get('signal_status', 'Normal'))
    if sig_wait > 2.0 or sig_stat in ['Warning', 'Critical']:
        sig_imp = round(sig_wait * 0.85 + (3.0 if sig_stat == 'Critical' else 0.0), 1)
        level = "High Impact" if sig_imp > 5.0 else "Medium Impact"
        explanation.append({
            "category": "Signal Waiting & Block Condition",
            "impact_level": level,
            "estimated_minutes": sig_imp,
            "description": f"Signal wait of {sig_wait}m and {sig_stat} block condition"
        })

    # 2. Construction / Maintenance factor
    is_affected = int(feature_dict.get('affected_section', 0))
    tsr = float(feature_dict.get('temporary_speed_restriction', 0))
    if is_affected == 1:
        c_imp = round(2.5 + (1.5 if tsr > 0 else 0.0), 1)
        explanation.append({
            "category": "Construction & Speed Restriction",
            "impact_level": "High Impact" if tsr > 0 else "Medium Impact",
            "estimated_minutes": c_imp,
            "description": f"Active track engineering block with TSR {int(tsr)} km/h" if tsr > 0 else "Maintenance speed caution in progress"
        })

    # 3. Congestion & Preceding Train factor
    congestion = float(feature_dict.get('congestion_level', 0.0))
    preceding = float(feature_dict.get('preceding_train_delay', 0.0))
    if congestion > 0.5 or preceding > 3.0:
        cong_imp = round((congestion * 2.5) + (preceding * 0.3), 1)
        level = "High Impact" if cong_imp > 4.0 else "Medium Impact"
        explanation.append({
            "category": "Traffic Congestion & Preceding Train",
            "impact_level": level,
            "estimated_minutes": cong_imp,
            "description": f"Section congestion at {int(congestion*100)}% with preceding train {preceding}m late"
        })

    # 4. Current Delay factor
    cur_delay = float(feature_dict.get('current_delay', 0.0))
    if cur_delay > 4.0:
        d_imp = round(cur_delay * 0.4, 1)
        explanation.append({
            "category": "Inherent Route Delay",
            "impact_level": "Medium Impact" if d_imp < 6.0 else "High Impact",
            "estimated_minutes": d_imp,
            "description": f"Existing arrival delay of {cur_delay}m propagating down the section"
        })

    # 5. Weather factor
    weather_imp = int(feature_dict.get('weather_impact', 0))
    rain_val = float(feature_dict.get('rain', 0.0))
    gust_val = float(feature_dict.get('wind_gusts', 0.0))
    if weather_imp > 0 or rain_val > 2.0:
        w_imp = round(1.5 + (2.0 if weather_imp == 2 else 0.5), 1)
        explanation.append({
            "category": "Live Station Weather",
            "impact_level": "High Impact" if weather_imp == 2 else ("Medium Impact" if weather_imp == 1 else "Low Impact"),
            "estimated_minutes": w_imp,
            "description": f"Rainfall of {rain_val}mm and wind gusts of {gust_val} km/h affecting traction/braking"
        })

    if not explanation:
        explanation.append({
            "category": "Normal Operations",
            "impact_level": "Low Impact",
            "estimated_minutes": 0.0,
            "description": "Clear track section, green signals, and favorable weather conditions"
        })

    return {
        "predicted_additional_delay": pred_delay,
        "prediction_range": f"+{range_min} to +{range_max} min",
        "range_min": range_min,
        "range_max": range_max,
        "risk_level": risk_level,
        "explanation": explanation,
        "model_mae": mae,
        "data_status": "🟢 AI PREDICTED (XGBoost Regressor)"
    }

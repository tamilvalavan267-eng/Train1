"""
RailGo Machine Learning - Model Training Script
Trains an XGBoost Regressor to predict actual_additional_delay_minutes.
Evaluates MAE, RMSE, R2, computes feature importances, and serializes the model.
"""

import os
import pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb

from ml.preprocess import engineer_features, FEATURE_COLUMNS


def train_railgo_model():
    dataset_path = 'e:/SREC/RailGo2/data/training_dataset.csv'
    model_output_path = 'e:/SREC/RailGo2/ml/railway_eta_model.pkl'

    print(f"Loading training dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)

    # Separate target
    target_col = 'actual_additional_delay_minutes'
    y = df[target_col].values

    # Preprocess and engineer features
    X = engineer_features(df)

    # Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"Training set: {X_train.shape[0]} samples, Test set: {X_test.shape[0]} samples")

    # Initialize and train XGBoost Regressor
    model = xgb.XGBRegressor(
        n_estimators=280,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        tree_method='hist'
    )

    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print("\n==========================================")
    print("       RAILGO XGBOOST MODEL EVALUATION     ")
    print("==========================================")
    print(f"Mean Absolute Error (MAE)  : {mae:.2f} minutes")
    print(f"Root Mean Squared Error (RMSE): {rmse:.2f} minutes")
    print(f"R-squared (R2 Score)       : {r2:.4f}")
    print("==========================================")

    # Extract Feature Importances
    importances = model.feature_importances_
    feat_imp = sorted(
        zip(FEATURE_COLUMNS, importances),
        key=lambda x: x[1],
        reverse=True
    )
    print("\nTop 10 Feature Importances:")
    for feat, imp in feat_imp[:10]:
        print(f"  - {feat:30s}: {imp * 100:.2f}%")

    # Serialize bundle
    payload = {
        'model': model,
        'feature_columns': FEATURE_COLUMNS,
        'metrics': {'mae': round(mae, 2), 'rmse': round(rmse, 2), 'r2': round(r2, 4)},
        'feature_importances': dict(feat_imp)
    }

    with open(model_output_path, 'wb') as f:
        pickle.dump(payload, f)

    print(f"\nModel and metadata successfully saved to {model_output_path}!")


if __name__ == '__main__':
    train_railgo_model()

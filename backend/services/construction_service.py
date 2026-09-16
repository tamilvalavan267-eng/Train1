"""
RailGo Construction & Maintenance Service
Manages authorised railway engineering blocks, track renewal works, and Temporary Speed Restrictions (TSR).
Performs intelligent route-section matching so delays are only applied to trains actually traversing affected zones.
"""

from datetime import datetime
from typing import List, Dict, Any

AUTHORISED_ENGINEERING_WORKS = [
    {
        "id": "ENG-SR-MAS-2026-041",
        "section": "Villivakkam - Korattur (Up & Down Slow)",
        "start_station": "Villivakkam",
        "end_station": "Korattur",
        "start_seq": 7,
        "end_seq": 8,
        "work_type": "Track Renewal & Deep Screening (BCM Machine)",
        "status": "Active",  # Active, Planned, Major restriction, Completed
        "start_time": "08:30 IST",
        "end_time": "16:00 IST",
        "speed_restriction": 20.0,  # km/h TSR
        "normal_speed": 50.0,
        "affected_route": "MASS-TRL Suburban Corridor",
        "affected_train_count": 14,
        "expected_delay_impact": 3.5,  # minutes
        "contractor_authority": "Senior Section Engineer (P-Way), Perambur",
        "data_status": "🟢 AUTHORISED RAILWAY ENGINEERING",
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
    },
    {
        "id": "ENG-SR-MAS-2026-088",
        "section": "Veppampattu - Sevvapet Road (Bridge No. 42)",
        "start_station": "Veppampattu",
        "end_station": "Sevvapet Road",
        "start_seq": 18,
        "end_seq": 19,
        "work_type": "Bridge Girders Inspection & Regirdering Pre-Work",
        "status": "Major restriction",
        "start_time": "06:00 IST",
        "end_time": "18:00 IST",
        "speed_restriction": 15.0,  # km/h TSR
        "normal_speed": 60.0,
        "affected_route": "MASS-TRL Suburban Corridor",
        "affected_train_count": 22,
        "expected_delay_impact": 5.0,
        "contractor_authority": "Deputy Chief Engineer (Bridges), Southern Railway",
        "data_status": "🟢 AUTHORISED RAILWAY ENGINEERING",
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
    },
    {
        "id": "ENG-SR-MAS-2026-112",
        "section": "Avadi Yard (Platform 3 & 4 Crossover)",
        "start_station": "Avadi",
        "end_station": "Hindu College",
        "start_seq": 13,
        "end_seq": 14,
        "work_type": "Point Machine Overhaul & Signaling Cable Maintenance",
        "status": "Planned",
        "start_time": "23:00 IST",
        "end_time": "04:30 IST",
        "speed_restriction": 30.0,
        "normal_speed": 50.0,
        "affected_route": "MASS-TRL Suburban Corridor",
        "affected_train_count": 5,
        "expected_delay_impact": 1.5,
        "contractor_authority": "Signal & Telecommunication (S&T), Avadi",
        "data_status": "🟢 AUTHORISED RAILWAY ENGINEERING",
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
    }
]


def get_all_construction_works() -> List[Dict[str, Any]]:
    """Returns all active, planned, and major restriction engineering blocks."""
    return AUTHORISED_ENGINEERING_WORKS


def check_train_construction_impact(current_station_seq: int, destination_seq: int = 21) -> Dict[str, Any]:
    """
    Section 9 Compliance: Route Matching
    Only triggers construction delay if the train has NOT YET passed the affected section.
    If the train is already past the work site, operational impact is 0.0!
    """
    active_works = []
    total_tsr_delay = 0.0
    active_tsr_speed = 0.0

    for work in AUTHORISED_ENGINEERING_WORKS:
        if work["status"] in ["Active", "Major restriction"]:
            w_start = work["start_seq"]
            w_end = work["end_seq"]
            
            # Check if train route intersects and train hasn't passed it yet
            if current_station_seq <= w_end and destination_seq >= w_start:
                active_works.append(work)
                total_tsr_delay += work["expected_delay_impact"]
                active_tsr_speed = max(active_tsr_speed, work["speed_restriction"])

    has_active = len(active_works) > 0
    return {
        "construction_active": 1 if has_active else 0,
        "maintenance_active": 1 if any("Maintenance" in w["work_type"] for w in active_works) else 0,
        "engineering_block": 1 if any("Block" in w["work_type"] or w["status"] == "Major restriction" for w in active_works) else 0,
        "temporary_speed_restriction": active_tsr_speed if has_active else 0.0,
        "affected_section": 1 if has_active else 0,
        "restriction_duration": 60 if has_active else 0,
        "expected_additional_delay": total_tsr_delay,
        "active_works_list": active_works,
        "summary": (
            f"{len(active_works)} active engineering blocks ahead (TSR {int(active_tsr_speed)} km/h)"
            if has_active else "No active construction blocks affecting upcoming train path"
        )
    }

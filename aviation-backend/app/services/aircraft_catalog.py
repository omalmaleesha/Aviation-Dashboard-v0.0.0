"""Static aircraft type catalog for frontend detail views.

All data is local, free, and returned by API endpoints.
Units:
  - length/wingspan/height: meters
  - maxTakeoffWeight/cargoCapacity/fuelCapacity: kilograms
  - maxSpeed/cruiseSpeed: km/h
  - range: kilometers
  - requiredRunwayLength: meters
  - serviceCeiling: feet
"""

from __future__ import annotations

from typing import Dict, List, Optional

from app.models.schemas import AircraftImageSet, AircraftTypeDetail
from app.services.aircraft import infer_aircraft_type
from app.services.opensky import get_current_flights


_AIRCRAFT_CATALOG: Dict[str, AircraftTypeDetail] = {
    "A320": AircraftTypeDetail(
        typeId="A320",
        modelName="Airbus A320-200",
        manufacturer="Airbus",
        category="Narrow-body Jet",
        length=37.57,
        wingspan=35.80,
        height=11.76,
        maxTakeoffWeight=78000,
        passengerCapacity=180,
        crewCapacity=6,
        cargoCapacity=16400,
        maxSpeed=871,
        cruiseSpeed=828,
        range=6150,
        fuelCapacity=24210,
        engineType="Turbofan",
        numberOfEngines=2,
        fuelType="Jet A-1",
        maintenanceInterval="A-check every 600 flight hours",
        requiredRunwayLength=2100,
        serviceCeiling=39000,
        images=AircraftImageSet(
            exteriorImage="https://source.unsplash.com/1600x900/?airbus,a320,aircraft,exterior&sig=101",
            interiorImage="https://source.unsplash.com/1600x900/?airplane,cabin,interior,airbus&sig=102",
            sideViewImage="https://source.unsplash.com/1600x900/?airbus,a320,airplane,side-view&sig=103",
            cockpitImage="https://source.unsplash.com/1600x900/?aircraft,cockpit,airbus&sig=104",
        ),
    ),
    "B737": AircraftTypeDetail(
        typeId="B737",
        modelName="Boeing 737-800",
        manufacturer="Boeing",
        category="Narrow-body Jet",
        length=39.47,
        wingspan=35.79,
        height=12.57,
        maxTakeoffWeight=79015,
        passengerCapacity=189,
        crewCapacity=6,
        cargoCapacity=20120,
        maxSpeed=876,
        cruiseSpeed=842,
        range=5765,
        fuelCapacity=26020,
        engineType="Turbofan",
        numberOfEngines=2,
        fuelType="Jet A-1",
        maintenanceInterval="A-check every 600 flight hours",
        requiredRunwayLength=2300,
        serviceCeiling=41000,
        images=AircraftImageSet(
            exteriorImage="https://source.unsplash.com/1600x900/?boeing,737,aircraft,exterior&sig=201",
            interiorImage="https://source.unsplash.com/1600x900/?airplane,cabin,interior,boeing&sig=202",
            sideViewImage="https://source.unsplash.com/1600x900/?boeing,737,airplane,side-view&sig=203",
            cockpitImage="https://source.unsplash.com/1600x900/?aircraft,cockpit,boeing&sig=204",
        ),
    ),
    "B777": AircraftTypeDetail(
        typeId="B777",
        modelName="Boeing 777-300ER",
        manufacturer="Boeing",
        category="Wide-body Jet",
        length=73.86,
        wingspan=64.80,
        height=18.50,
        maxTakeoffWeight=351500,
        passengerCapacity=396,
        crewCapacity=14,
        cargoCapacity=56000,
        maxSpeed=950,
        cruiseSpeed=905,
        range=13650,
        fuelCapacity=181280,
        engineType="High-bypass Turbofan",
        numberOfEngines=2,
        fuelType="Jet A-1",
        maintenanceInterval="A-check every 750 flight hours",
        requiredRunwayLength=3000,
        serviceCeiling=43100,
        images=AircraftImageSet(
            exteriorImage="https://source.unsplash.com/1600x900/?boeing,777,aircraft,exterior&sig=301",
            interiorImage="https://source.unsplash.com/1600x900/?widebody,aircraft,cabin,interior&sig=302",
            sideViewImage="https://source.unsplash.com/1600x900/?boeing,777,airplane,side-view&sig=303",
            cockpitImage="https://source.unsplash.com/1600x900/?aircraft,cockpit,widebody&sig=304",
        ),
    ),
}


def list_aircraft_types() -> List[AircraftTypeDetail]:
    return list(_AIRCRAFT_CATALOG.values())


def get_aircraft_type(type_id: str) -> Optional[AircraftTypeDetail]:
    return _AIRCRAFT_CATALOG.get(type_id.strip().upper())


def get_aircraft_type_for_flight(flight_id: str) -> Optional[AircraftTypeDetail]:
    target = flight_id.strip().upper()
    flights = get_current_flights()
    matched = next((f for f in flights if f.flightId.strip().upper() == target), None)

    if matched is None:
        return None

    resolved_type = (matched.aircraft_type or "").strip().upper() or infer_aircraft_type(
        matched.flightId,
        speed_kts=matched.speed,
        altitude_ft=matched.altitude,
    )
    return _AIRCRAFT_CATALOG.get(resolved_type)

package com.example.seatMe.aircraft;

// 기종 조회 결과 (화면/팀원에게 돌려주는 값)
public record AircraftTypeResult(
        String flightNo,       // 편명 (예: RS6347)
        String departureTime,  // 출발 예정 시각 (예: 2026-11-11 06:00)
        String from,           // 출발 공항 (예: GMP)
        String to,             // 도착 공항 (예: CJU)
        String aircraftType    // 기종 ICAO 코드 (예: A321)
) {}

package com.example.seatMe.flight;

/**
 * 화면에 돌려주는 항공편 한 개 — 명세서(docs/API_명세서.html) 3번 "응답"의 8칸.
 * 앞 5칸은 백엔드①(국토부), 뒤 3칸(기종)은 백엔드②(공항공사)가 채운다.
 */
public record Flight(
        String airline,         // 항공사 이름 · "제주항공"
        String flightNumber,    // 편명 · "7C115"
        String departureTime,   // 출발 "14:10" (24시간, 한국 시각)
        String arrivalTime,     // 도착 "15:20"
        String duration,        // "1시간 10분"
        String aircraft,        // 백엔드② · 화면 이름 "B737-8", 모르면 ""
        String aircraftCode,    // 백엔드② · 공항공사 코드 "B738", 모르면 ""
        boolean seatMapReady    // 백엔드② · 좌석 배치도가 있는 기종이면 true
) {}

package com.example.seatMe.flight;

import java.util.Map;

/**
 * 화면에 돌려주는 항공편 한 개 — 명세서(docs/API_명세서.html) 3번 "응답"의 8칸.
 * 앞 5칸은 국토부 답으로, 뒤 3칸(기종)은 공항공사 답으로 채운다.
 */
public record Flight(
        String airline,         // 항공사 이름 · "제주항공"
        String flightNumber,    // 편명 · "7C115"
        String departureTime,   // 출발 "14:10" (24시간, 한국 시각)
        String arrivalTime,     // 도착 "15:20"
        String duration,        // "1시간 10분"
        String aircraft,        // 화면 이름 "B737-8", 모르면 ""
        String aircraftCode,    // 공항공사 코드 "B738", 모르면 ""
        boolean seatMapReady    // 좌석 배치도가 있는 기종이면 true
) {

    /** 좌석 배치도가 있는 기종: 공항공사 코드 → 화면 이름 (명세서 6번 표). 배치도가 늘면 여기에 한 줄 추가한다. */
    private static final Map<String, String> SEAT_MAP_AIRCRAFT = Map.of("B738", "B737-8");

    /** 공항공사 코드로 기종 3칸을 채운다. 코드가 null(짝 없음)이면 비워 둔 채 그대로 돌려준다. */
    Flight withAircraftCode(String code) {
        if (code == null) {
            return this;
        }
        return new Flight(airline, flightNumber, departureTime, arrivalTime, duration,
                SEAT_MAP_AIRCRAFT.getOrDefault(code, code), code, SEAT_MAP_AIRCRAFT.containsKey(code));
    }
}

package com.example.seatMe.flight;

import com.example.seatMe.aircraft.AircraftNames;
import java.util.List;

/**
 * 화면에 돌려주는 항공편 한 개 (10칸).
 * 앞 5칸은 국토부 답으로, 뒤 5칸(기종 · 배치도)은 공항공사 답과 좌석 배치도 파일로 채운다.
 */
public record Flight(
        String airline,         // 항공사 이름 · "제주항공"
        String flightNumber,    // 편명 · "7C115"
        String departureTime,   // 출발 "14:10" (24시간, 한국 시각)
        String arrivalTime,     // 도착 "15:20"
        String duration,        // "1시간 10분"
        String aircraft,        // 화면 이름 "B737-800", 모르면 ""
        String aircraftCode,    // 공항공사 코드 "B738", 모르면 ""
        boolean seatMapReady,   // 그 항공사 + 기종의 배치도가 하나라도 있으면 true
        List<String> seatMaps,  // 후보 배치도 id (대표가 맨 앞), 없으면 []
        boolean seatMapConfirmed // 후보가 정확히 하나로 정해졌으면 true
) {

    /** 공항공사 코드와 배치도 후보로 기종 5칸을 채운다. */
    Flight withAircraft(String code, List<String> seatMaps, boolean confirmed) {
        return new Flight(airline, flightNumber, departureTime, arrivalTime, duration,
                AircraftNames.of(code), code, !seatMaps.isEmpty(), seatMaps, confirmed);
    }
}

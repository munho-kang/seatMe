package com.example.seatMe.aircraft;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/aircraft")
public class AircraftTypeController {

    private final AircraftTypeClient aircraftTypeClient;
    private final AircraftTypeService aircraftTypeService;

    public AircraftTypeController(AircraftTypeClient aircraftTypeClient,
                                  AircraftTypeService aircraftTypeService) {
        this.aircraftTypeClient = aircraftTypeClient;
        this.aircraftTypeService = aircraftTypeService;
    }

    // 편명 → 기종
    // 예: /api/aircraft?flightNo=RS6347                 (오늘 ~ 6일 뒤 중 가장 가까운 편)
    // 예: /api/aircraft?flightNo=RS6347&date=2026-11-11 (특정 날짜)
    @GetMapping
    public ResponseEntity<?> aircraftType(
            @RequestParam String flightNo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        AircraftTypeResult result = aircraftTypeService.find(flightNo, date);
        if (result == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "flightNo", flightNo,
                    "message", "기종 정보를 찾지 못했어요 (조회 가능 범위: 오늘 ~ 6일 뒤)"));
        }
        return ResponseEntity.ok(result);
    }

    // 원본 응답 확인용: /api/aircraft/raw?flightNo=RS6347&date=20261111
    @GetMapping("/raw")
    public List<KacAircraftResponse.Item> raw(@RequestParam String flightNo,
                                              @RequestParam String date) {
        return aircraftTypeClient.search(flightNo, date + "0000", date + "2359");
    }
}

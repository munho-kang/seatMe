package com.example.seatMe.flight;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import com.example.seatMe.aircraft.AircraftTypeService;
import com.example.seatMe.aircraft.KacAircraftResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 화면이 부르는 창구 — GET /api/flights?from=GMP&to=CJU&date=2026-11-13 (명세서 2 · 4 · 5번).
 * 요청을 먼저 확인해 틀리면 400, 국토부가 답하지 않으면 502, 아니면 {"flights":[...]}.
 */
@RestController
public class FlightController {

    /** 우리 공항 코드 → 국토부 공항 ID. 제주·부산 값은 인증키가 나오면 GetArprtList로 한 번 확인한다. */
    static final Map<String, String> MOLIT_AIRPORT_ID = Map.of(
            "GMP", "NAARKSS",  // 김포
            "CJU", "NAARKPC",  // 제주
            "PUS", "NAARKPK"); // 부산(김해)

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Logger log = LoggerFactory.getLogger(FlightController.class);

    private final MolitClient molit;
    private final AircraftTypeService aircraftTypes;

    FlightController(MolitClient molit, AircraftTypeService aircraftTypes) {
        this.molit = molit;
        this.aircraftTypes = aircraftTypes;
    }

    @GetMapping("/api/flights")
    ResponseEntity<?> flights(@RequestParam(required = false) String from,
                              @RequestParam(required = false) String to,
                              @RequestParam(required = false) String date) {
        LocalDate day = parseDate(date);
        boolean valid = isAirport(from) && isAirport(to) && !from.equals(to)
                && day != null && !day.isBefore(LocalDate.now(KST));
        if (!valid) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_QUERY"));
        }
        try {
            List<Flight> flights = molit.search(MOLIT_AIRPORT_ID.get(from), MOLIT_AIRPORT_ID.get(to), day);
            // 항공편이 있을 때만 공항공사에 묻고, 편명 + 가장 가까운 출발 시각으로 합친다 (명세서 6번). 답이 없으면 기종만 빈 채로 나간다.
            Map<String, List<KacAircraftResponse.Item>> records =
                    flights.isEmpty() ? Map.of() : aircraftTypes.findByRoute(from, to, day);
            return ResponseEntity.ok(Map.of("flights", flights.stream()
                    .map(flight -> flight.withAircraftCode(AircraftTypeService.nearestAircraftType(
                            records.get(flight.flightNumber()), flight.departureTime())))
                    .toList()));
        } catch (MolitClient.UpstreamException e) {
            log.warn("국토부 응답 실패 → 502: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "UPSTREAM_UNAVAILABLE"));
        }
    }

    private static boolean isAirport(String code) {
        return code != null && MOLIT_AIRPORT_ID.containsKey(code);
    }

    /** YYYY-MM-DD 만 받는다. 다른 모양이거나 비어 있으면 null. */
    private static LocalDate parseDate(String date) {
        try {
            return date == null ? null : LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}

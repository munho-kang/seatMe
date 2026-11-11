package com.example.seatMe.flight;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import com.example.seatMe.aircraft.AircraftTypeService;
import com.example.seatMe.aircraft.KacAircraftResponse;
import com.example.seatMe.seatmap.SeatMapRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 화면이 부르는 창구 — GET /api/flights?from=GMP&to=CJU&date=2026-11-13.
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

    private final SeatMapRepository seatMaps;

    FlightController(MolitClient molit, AircraftTypeService aircraftTypes, SeatMapRepository seatMaps) {
        this.molit = molit;
        this.aircraftTypes = aircraftTypes;
        this.seatMaps = seatMaps;
    }

    @GetMapping("/api/flights")
    ResponseEntity<?> flights(@RequestParam(required = false) String from,
                              @RequestParam(required = false) String to,
                              @RequestParam(required = false) String date) {
        LocalDate day = validDay(from, to, date);
        if (day == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_QUERY"));
        }
        try {
            List<Flight> flights = notDeparted(
                    molit.search(MOLIT_AIRPORT_ID.get(from), MOLIT_AIRPORT_ID.get(to), day), day, LocalDateTime.now(KST));
            // 항공편이 있을 때만 공항공사에 묻고, 편명 + 가장 가까운 출발 시각으로 합친다. 답이 없으면 기종만 빈 채로 나간다.
            Map<String, List<KacAircraftResponse.Item>> records =
                    flights.isEmpty() ? Map.of() : aircraftTypes.findByRoute(from, to, day);
            return ResponseEntity.ok(Map.of("flights", flights.stream()
                    .map(flight -> withSeatMaps(flight, AircraftTypeService.nearestRecord(
                            records.get(flight.flightNumber()), flight.departureTime())))
                    .toList()));
        } catch (MolitClient.UpstreamException e) {
            log.warn("국토부 응답 실패 → 502: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "UPSTREAM_UNAVAILABLE"));
        }
    }

    /** 기록이 없으면 항공편 그대로. 있으면 편명 앞 두 글자(항공사) + 기종 + 등록번호로 배치도 후보를 붙인다. */
    private Flight withSeatMaps(Flight flight, KacAircraftResponse.Item record) {
        if (record == null) {
            return flight;
        }
        String number = flight.flightNumber();
        String airline = number.length() < 2 ? null : number.substring(0, 2);
        var candidates = seatMaps.candidatesFor(airline, record.icaoApmCd(), record.aplRegNo());
        return flight.withAircraft(record.icaoApmCd(), candidates.ids(), candidates.confirmed());
    }

    /** 오늘 검색이면 이미 떠난 편(출발 시각이 지금이거나 그 전)을 뺀다. 다 빠지면 빈 목록 → 상황 ①. */
    static List<Flight> notDeparted(List<Flight> flights, LocalDate day, LocalDateTime now) {
        if (!day.equals(now.toLocalDate())) {
            return flights;
        }
        return flights.stream()
                .filter(flight -> LocalTime.parse(flight.departureTime()).isAfter(now.toLocalTime()))
                .toList();
    }

    /** from · to · date가 규칙에 맞으면 그 날짜, 아니면 null. /api/recommend도 같은 규칙을 쓴다. */
    public static LocalDate validDay(String from, String to, String date) {
        LocalDate day = parseDate(date);
        LocalDate today = LocalDate.now(KST);
        // 날짜는 오늘 ~ 1년 뒤. 더 먼 날짜(+12345-01-01 같은 것)는 국토부에 묻지 않는다
        boolean valid = isAirport(from) && isAirport(to) && !from.equals(to)
                && day != null && !day.isBefore(today) && !day.isAfter(today.plusYears(1));
        return valid ? day : null;
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

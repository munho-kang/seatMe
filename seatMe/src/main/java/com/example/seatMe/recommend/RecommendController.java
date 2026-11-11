package com.example.seatMe.recommend;

import com.example.seatMe.aircraft.AircraftNames;
import com.example.seatMe.flight.FlightController;
import com.example.seatMe.recommend.SeatScorer.Preferences;
import com.example.seatMe.recommend.SeatScorer.Scored;
import com.example.seatMe.seatmap.SeatMapRepository;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 화면이 부르는 창구 — GET /api/recommend. 고른 항공편(시각 · 기종 · 배치도)과 취향으로 일반석 TOP 3를 계산한다.
 * 계산만 한다: 공공데이터를 다시 부르지 않고, 화면이 /api/flights에서 받은 값을 그대로 실어 보낸다.
 * 화면이 보낸 값이라 형식을 전부 확인한다. 규칙은 RecommendApiTest 머리 주석이 기준이다.
 */
@RestController
public class RecommendController {

    record Response(String aircraft, String seatMapId, Sun sun, List<Scored> seats) {}

    private static final Pattern FLIGHT = Pattern.compile("[A-Z0-9]{2}\\d{1,4}[A-Z]?");
    private static final Pattern HH_MM = Pattern.compile("([01]\\d|2[0-3]):[0-5]\\d");
    private static final int TOP = 3;
    /** 국내선은 길어야 1시간 남짓이다. 이보다 길면(도착이 출발보다 훨씬 이른 값 포함) 잘못 보낸 값으로 본다. */
    private static final Duration MAX_FLIGHT = Duration.ofHours(3);

    private final SeatMapRepository seatMaps;

    RecommendController(SeatMapRepository seatMaps) {
        this.seatMaps = seatMaps;
    }

    @GetMapping("/api/recommend")
    ResponseEntity<?> recommend(@RequestParam Map<String, String> q) {
        LocalDate day = FlightController.validDay(q.get("from"), q.get("to"), q.get("date"));
        String flight = q.get("flight");
        LocalTime dep = time(q.get("dep"));
        LocalTime arr = time(q.get("arr"));
        List<Integer> levels = Stream.of("sunlight", "view", "quietness", "turbulence", "quickExit")
                .map(name -> q.get(name) != null && q.get(name).matches("[1-5]") ? Integer.valueOf(q.get(name)) : null)
                .toList();
        String seatPosition = q.get("seatPosition");
        if (day == null || flight == null || !FLIGHT.matcher(flight).matches() || dep == null || arr == null
                // 도착이 출발보다 이르면 다음 날 도착 (Sun.of와 같은 규칙)
                || Duration.between(dep, arr).plusDays(arr.isAfter(dep) ? 0 : 1).compareTo(MAX_FLIGHT) > 0
                || levels.contains(null) || !SeatScorer.POSITION_WEIGHT.containsKey(seatPosition == null ? "" : seatPosition)) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_QUERY"));
        }

        // /api/flights의 seatMapReady와 같은 판단: 편명 앞 두 글자(항공사) + 기종 코드의 배치도 후보
        List<String> candidates = seatMaps.candidatesFor(flight.substring(0, 2), q.get("aircraftCode"), null).ids();
        if (candidates.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "SEAT_MAP_NOT_READY"));
        }
        String seatMapId = q.get("seatMap");
        if (seatMapId == null || !candidates.contains(seatMapId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "INVALID_QUERY"));
        }

        Sun sun = Sun.of(q.get("from"), q.get("to"), day, dep, arr);
        List<Scored> ranked = SeatScorer.rank(seatMaps.findById(seatMapId).orElseThrow(), sun,
                new Preferences(levels.get(0), levels.get(1), levels.get(2), levels.get(3), levels.get(4), seatPosition));
        return ResponseEntity.ok(new Response(AircraftNames.of(q.get("aircraftCode")), seatMapId, sun,
                ranked.subList(0, Math.min(TOP, ranked.size()))));
    }

    /** "HH:mm"만 받는다. 다른 모양이거나 비어 있으면 null. */
    private static LocalTime time(String hhmm) {
        return hhmm != null && HH_MM.matcher(hhmm).matches() ? LocalTime.parse(hhmm) : null;
    }
}

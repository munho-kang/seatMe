package com.example.seatMe.recommend;

import com.example.seatMe.aircraft.AircraftNames;
import com.example.seatMe.flight.FlightController;
import com.example.seatMe.recommend.SeatScorer.Preferences;
import com.example.seatMe.recommend.SeatScorer.Scored;
import com.example.seatMe.seatmap.SeatMapRepository;
import com.example.seatMe.weather.KmaClient;
import com.example.seatMe.weather.KmaClient.Forecast;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 화면이 부르는 창구 — GET /api/recommend. 고른 항공편(시각 · 기종 · 배치도)과 취향으로 일반석 TOP 3를 계산한다.
 * 좌석과 점수는 계산만으로 정한다: 항공편 공공데이터를 다시 부르지 않고, 화면이 /api/flights에서 받은 값을 그대로 실어 보낸다.
 * 기상청 예보는 설명 한 줄(weatherNote)에만 쓴다. 기상청이 답하지 않아도 추천은 그대로 나간다.
 * 화면이 보낸 값이라 형식을 전부 확인한다. 규칙은 RecommendApiTest 머리 주석이 기준이다.
 */
@RestController
public class RecommendController {

    record Response(String aircraft, String seatMapId, Sun sun, List<Scored> seats, String weatherNote) {}

    private static final Map<String, String> AIRPORT_NAMES = Map.of("GMP", "김포공항", "CJU", "제주공항", "PUS", "김해공항");

    private static final Pattern FLIGHT = Pattern.compile("[A-Z0-9]{2}\\d{1,4}[A-Z]?");
    private static final Pattern HH_MM = Pattern.compile("([01]\\d|2[0-3]):[0-5]\\d");
    private static final int TOP = 3;
    /** 국내선은 길어야 1시간 남짓이다. 이보다 길면(도착이 출발보다 훨씬 이른 값 포함) 잘못 보낸 값으로 본다. */
    private static final Duration MAX_FLIGHT = Duration.ofHours(3);

    private final SeatMapRepository seatMaps;
    private final KmaClient kma;

    RecommendController(SeatMapRepository seatMaps, KmaClient kma) {
        this.seatMaps = seatMaps;
        this.kma = kma;
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
                ranked.subList(0, Math.min(TOP, ranked.size())),
                weatherNote(q.get("from"), q.get("to"), day.atTime(dep), day.atTime(arr).plusDays(arr.isAfter(dep) ? 0 : 1), sun)));
    }

    /**
     * 날씨 설명 한 줄, 없으면 null. 점수는 바꾸지 않는다: 비행기는 이륙 몇 분 뒤 구름 위로 올라가서 날씨가 햇빛을 가리는 것은 이착륙 몇 분뿐이다.
     * 문구는 임시다 (디자인 확인).
     */
    private String weatherNote(String from, String to, LocalDateTime departAt, LocalDateTime arriveAt, Sun sun) {
        if (sun.left() == 0 && sun.right() == 0) return null; // 밤 비행은 가릴 햇빛이 없다
        // 두 공항을 동시에 묻는다 (한 번에 1초쯤 걸린다)
        var departing = CompletableFuture.supplyAsync(() -> kma.forecast(from, departAt));
        Forecast arrival = kma.forecast(to, arriveAt);
        Forecast departure = departing.join();

        String cloudy = Stream.of(cloud("출발할 때 ", from, departure), cloud("도착할 때 ", to, arrival))
                .filter(Objects::nonNull).collect(Collectors.joining(", "));
        if (cloudy.isEmpty() && (departure == null || arrival == null)) return null; // 한쪽이라도 모르면 "모두 없어요"라고 못 한다
        LocalDateTime announced = (departure != null ? departure : arrival).announced();
        return (cloudy.isEmpty() ? "출발 · 도착 공항 모두 흐림 · 비 예보가 없어요" : cloudy + " 예보라 햇빛 걱정이 적어요")
                + " (%d일 %d시 발표 예보 기준)".formatted(announced.getDayOfMonth(), announced.getHour());
    }

    /** "출발할 때 김포공항 흐림". 예보가 없거나 흐림 · 비 · 눈이 아니면 null (구름많음은 흐림으로 치지 않는다). */
    private static String cloud(String when, String airport, Forecast forecast) {
        if (forecast == null) return null;
        String sky = switch (forecast.pty()) {
            case 0 -> forecast.sky() == 4 ? "흐림" : null;
            case 2 -> "비 또는 눈";
            case 3 -> "눈";
            case 4 -> "소나기";
            default -> "비";
        };
        return sky == null ? null : when + AIRPORT_NAMES.get(airport) + " " + sky;
    }

    /** "HH:mm"만 받는다. 다른 모양이거나 비어 있으면 null. */
    private static LocalTime time(String hhmm) {
        return hhmm != null && HH_MM.matcher(hhmm).matches() ? LocalTime.parse(hhmm) : null;
    }
}

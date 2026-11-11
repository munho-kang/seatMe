package com.example.seatMe.weather;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.Map;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 기상청 단기예보에 묻는다: 공항 + 시각 → 그때의 하늘 상태와 강수.
 * 문서: https://www.data.go.kr/data/15084084/openapi.do
 * 실패하면 예외 대신 null을 준다. 날씨는 추천에 붙는 설명 한 줄일 뿐이라 기상청이 죽어도 추천은 나가야 한다.
 * 결과를 저장하지 않는다 (볼 때마다 새 예보).
 */
@Component
public class KmaClient {

    /** sky: 1 맑음 · 3 구름많음 · 4 흐림. pty: 0 없음 · 1 비 · 2 비/눈 · 3 눈 · 4 소나기. announced: 그 예보를 발표한 시각. */
    public record Forecast(int sky, int pty, LocalDateTime announced) {}

    /**
     * 공항의 예보 격자 {nx, ny}. 단기예보는 위경도가 아니라 5km 격자 번호로 묻는다.
     * Sun.AIRPORTS의 좌표를 포털 문서의 변환식(Lambert 정각원추)에 넣어 구했다. 공항을 늘리면 같은 식으로 구해 넣는다.
     */
    static final Map<String, int[]> GRID = Map.of(
            "GMP", new int[] {57, 126},  // 김포
            "CJU", new int[] {52, 38},   // 제주
            "PUS", new int[] {95, 76});  // 김해

    /** 예보는 발표 4~5일 뒤 자정까지만 나온다 (2026-11-11 측정). 이보다 먼 비행은 묻지 않는다. */
    static final Duration RANGE = Duration.ofDays(5);
    /** 예보 간격은 1시간이고 사흘쯤 뒤부터 3시간이다. 가장 가까운 예보가 이보다 멀면 예보가 없는 것으로 본다. */
    static final Duration MAX_GAP = Duration.ofMinutes(90);
    /** 발표(02시부터 3시간마다) 뒤 이만큼 지나야 받을 수 있다 (문서로는 10분). */
    static final Duration PUBLISH_DELAY = Duration.ofMinutes(15);

    private static final Logger log = LoggerFactory.getLogger(KmaClient.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter DATE = DateTimeFormatter.BASIC_ISO_DATE;             // 20261111
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HHmm");          // 2300
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    private final ObjectMapper json;
    private final HttpClient http;
    private final Duration timeout;
    private final String baseUrl;
    private final String encodedServiceKey;

    KmaClient(ObjectMapper json,
              @Value("${seatme.kma.base-url}") String baseUrl,
              @Value("${seatme.kma.service-key}") String serviceKey,
              @Value("${seatme.kma.timeout-ms}") long timeoutMs) {
        this.json = json;
        this.baseUrl = baseUrl;
        this.timeout = Duration.ofMillis(timeoutMs);
        this.http = HttpClient.newBuilder().connectTimeout(timeout).build();
        // MolitClient와 같은 규칙: Decoding 키는 여기서 부호화하고, 이미 부호화된(% 포함) Encoding 키는 그대로 쓴다.
        this.encodedServiceKey = serviceKey.contains("%") ? serviceKey : URLEncoder.encode(serviceKey, StandardCharsets.UTF_8);
        if (serviceKey.isBlank()) {
            log.warn("기상청 인증키가 비어 있어요. seatMe/.env.local 에 KMA_SERVICE_KEY=발급받은키 를 넣어 주세요. 키가 없으면 추천에 날씨 한 줄이 붙지 않아요.");
        }
    }

    /** 그 공항 · 그 시각(한국 시각)에 가장 가까운 예보. 예보가 없거나 기상청이 제대로 답하지 않으면 null. */
    public Forecast forecast(String airport, LocalDateTime when) {
        LocalDateTime now = LocalDateTime.now(KST);
        if (encodedServiceKey.isEmpty() || when.isAfter(now.plus(RANGE))) {
            return null;
        }
        // 가장 최근 발표 시각: 02 · 05 · 08 · 11 · 14 · 17 · 20 · 23시
        LocalDateTime ready = now.minus(PUBLISH_DELAY);
        LocalDateTime announced = ready.minusHours((ready.getHour() + 1) % 3).truncatedTo(ChronoUnit.HOURS);
        int[] grid = GRID.get(airport);
        // 한 번에 1,000줄쯤 온다 (모든 시각 × 기온 · 바람 등 14종류). 종류나 시각으로 골라 받는 방법은 없다.
        URI uri = URI.create(baseUrl + "/getVilageFcst?serviceKey=" + encodedServiceKey
                + "&dataType=JSON&numOfRows=2000&pageNo=1"
                + "&base_date=" + announced.format(DATE) + "&base_time=" + announced.format(TIME)
                + "&nx=" + grid[0] + "&ny=" + grid[1]);
        try {
            HttpResponse<String> response = http.send(
                    HttpRequest.newBuilder(uri).timeout(timeout).GET().build(), HttpResponse.BodyHandlers.ofString());
            JsonNode root = json.readTree(response.body());
            JsonNode header = root.path("response").path("header");
            if (!"00".equals(header.path("resultCode").asString())) {
                log.warn("기상청 오류 응답 → 날씨 한 줄만 뺀다: {} {}", header.path("resultCode").asString(), header.path("resultMsg").asString());
                return null;
            }
            // 예보 시각 → {SKY, PTY}
            Map<LocalDateTime, int[]> slots = new TreeMap<>();
            for (JsonNode item : root.path("response").path("body").path("items").path("item")) {
                String category = item.path("category").asString();
                if (!category.equals("SKY") && !category.equals("PTY")) continue;
                LocalDateTime at = LocalDateTime.parse(item.path("fcstDate").asString() + item.path("fcstTime").asString(), DATE_TIME);
                slots.computeIfAbsent(at, key -> new int[2])[category.equals("SKY") ? 0 : 1] =
                        Integer.parseInt(item.path("fcstValue").asString());
            }
            return slots.entrySet().stream()
                    .min(Comparator.comparing(slot -> Duration.between(slot.getKey(), when).abs()))
                    .filter(slot -> Duration.between(slot.getKey(), when).abs().compareTo(MAX_GAP) <= 0)
                    .map(slot -> new Forecast(slot.getValue()[0], slot.getValue()[1], announced))
                    .orElse(null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (IOException | RuntimeException e) { // 시간 초과, JSON이 아닌 응답, 모르는 칸 모양
            log.warn("기상청 예보 실패 → 날씨 한 줄만 뺀다: {}", e.toString());
            return null;
        }
    }
}

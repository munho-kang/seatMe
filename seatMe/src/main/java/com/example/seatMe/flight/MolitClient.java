package com.example.seatMe.flight;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 국토교통부(TAGO) 국내항공운항정보에 인증키를 붙여 묻고, 답을 명세서 모양 {@link Flight}으로 바꾼다.
 * 문서: https://www.data.go.kr/data/15098526/openapi.do
 */
@Component
public class MolitClient {

    /** 국토부가 제때 올바른 답을 주지 않았다 (시간 초과 · 오류 · 읽을 수 없는 응답). 창구는 이걸 502로 바꾼다. */
    public static class UpstreamException extends RuntimeException {
        UpstreamException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private static final Logger log = LoggerFactory.getLogger(MolitClient.class);
    private static final DateTimeFormatter MOLIT_DATE = DateTimeFormatter.BASIC_ISO_DATE;             // 20261113
    private static final DateTimeFormatter MOLIT_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmm"); // 202611131410

    private final ObjectMapper json;
    private final HttpClient http;
    private final Duration timeout;
    private final String baseUrl;
    private final String encodedServiceKey;

    MolitClient(ObjectMapper json,
                @Value("${seatme.molit.base-url}") String baseUrl,
                @Value("${seatme.molit.service-key}") String serviceKey,
                @Value("${seatme.molit.timeout-ms}") long timeoutMs) {
        this.json = json;
        this.baseUrl = baseUrl;
        this.timeout = Duration.ofMillis(timeoutMs);
        this.http = HttpClient.newBuilder().connectTimeout(timeout).build();
        // 포털은 키를 Encoding/Decoding 두 가지로 보여 준다. Decoding 키는 여기서 부호화하고, 이미 부호화된(% 포함) Encoding 키는 그대로 쓴다.
        this.encodedServiceKey = serviceKey.contains("%") ? serviceKey : URLEncoder.encode(serviceKey, StandardCharsets.UTF_8);
        if (serviceKey.isBlank()) {
            log.warn("국토부 인증키가 비어 있어요. seatMe/.env.local 에 MOLIT_SERVICE_KEY=발급받은키 를 넣어 주세요. 키가 없으면 /api/flights 는 늘 502예요.");
        }
    }

    /** 출발·도착은 국토부 공항 ID(NAARKSS 등). 출발 시각 순으로 돌려준다. */
    public List<Flight> search(String depAirportId, String arrAirportId, LocalDate date) {
        // ponytail: 한 노선 하루 운항은 500편을 넘지 않는다고 보고 한 장(pageNo=1)에 다 받는다. totalCount가 더 크면 pageNo를 넘기도록 바꾼다.
        URI uri = URI.create(baseUrl + "/GetFlightOpratInfoList"
                + "?serviceKey=" + encodedServiceKey
                + "&depAirportId=" + depAirportId
                + "&arrAirportId=" + arrAirportId
                + "&depPlandTime=" + date.format(MOLIT_DATE)
                + "&numOfRows=500&pageNo=1&_type=json");
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(timeout).GET().build();

        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) { // 시간 초과(HttpTimeoutException)도 여기로 온다
            throw new UpstreamException("국토부가 답하지 않았어요: " + e, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new UpstreamException("국토부를 기다리다 중단됐어요", e);
        }
        if (response.statusCode() != 200) {
            throw new UpstreamException("국토부 HTTP " + response.statusCode() + " " + head(response.body()), null);
        }
        try {
            return parse(json.readTree(response.body()));
        } catch (UpstreamException e) {
            throw e;
        } catch (RuntimeException e) { // JSON이 아니거나 칸 모양이 다를 때
            throw new UpstreamException("국토부 응답을 읽을 수 없어요: " + head(response.body()), e);
        }
    }

    private List<Flight> parse(JsonNode root) {
        JsonNode header = root.path("response").path("header");
        if (!"00".equals(header.path("resultCode").asString())) {
            throw new UpstreamException("국토부 오류 " + header.path("resultCode").asString() + " " + header.path("resultMsg").asString(), null);
        }
        // 국토부는 결과가 0개면 items를 빈 글자 ""로, 1개면 item을 목록이 아닌 객체 하나로 준다
        JsonNode item = root.path("response").path("body").path("items").path("item");
        List<Flight> flights = new ArrayList<>();
        if (item.isArray()) {
            item.forEach(node -> flights.add(toFlight(node)));
        } else if (item.isObject()) {
            flights.add(toFlight(item));
        }
        flights.sort(Comparator.comparing(Flight::departureTime));
        return flights;
    }

    private static Flight toFlight(JsonNode node) {
        LocalDateTime dep = LocalDateTime.parse(node.path("depPlandTime").asString(), MOLIT_TIME);
        LocalDateTime arr = LocalDateTime.parse(node.path("arrPlandTime").asString(), MOLIT_TIME);
        return new Flight(
                node.path("airlineNm").asString(),
                node.path("vihicleId").asString(), // 국토부 칸 이름이 원래 이렇게(vehicle 오타) 적혀 있다
                dep.toLocalTime().toString(),      // "14:10"
                arr.toLocalTime().toString(),
                formatDuration(Duration.between(dep, arr)),
                "", "", false);                    // 기종 3칸은 백엔드②가 채운다 — 비어 있으면 상황 ④ "추천 준비 중"
    }

    static String formatDuration(Duration d) {
        long h = d.toHours();
        int m = d.toMinutesPart();
        if (h == 0) return m + "분";
        if (m == 0) return h + "시간";
        return h + "시간 " + m + "분";
    }

    private static String head(String body) {
        return body == null ? "" : body.strip().substring(0, Math.min(200, body.strip().length()));
    }
}

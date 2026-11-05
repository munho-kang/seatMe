package com.example.seatMe.flight;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MockMvcTester.MockMvcRequestBuilder;

/**
 * 창구 GET /api/flights 확인. 국토부 자리에는 이 테스트가 띄운 가짜 서버가 앉아 있다.
 * 명세서(docs/API_명세서.html) 2·4·5번: 요청 확인 규칙, 상황 4가지, 공항 코드 바꾸기.
 */
@SpringBootTest
@AutoConfigureMockMvc
class FlightApiTest {

    // 가짜 국토부 서버 — 테스트마다 돌려줄 응답(몸통·상태·지연)을 바꿔 끼운다
    static final AtomicReference<String> molitBody = new AtomicReference<>("");
    static final AtomicInteger molitStatus = new AtomicInteger(200);
    static final AtomicInteger molitDelayMs = new AtomicInteger(0);
    static final AtomicInteger molitCalls = new AtomicInteger(0);
    static final AtomicReference<String> molitLastQuery = new AtomicReference<>();
    static final HttpServer MOLIT = startFakeMolit();

    static final String VALID_DATE = LocalDate.now().plusDays(7).toString();
    static final String VALID_DATE_MOLIT = VALID_DATE.replace("-", ""); // 국토부는 20261113 모양
    static final String PAST_DATE = LocalDate.now().minusDays(1).toString();

    @DynamicPropertySource
    static void pointAtFakeMolit(DynamicPropertyRegistry registry) {
        registry.add("seatme.molit.base-url", () -> "http://localhost:" + MOLIT.getAddress().getPort());
        registry.add("seatme.molit.timeout-ms", () -> 300);
        registry.add("seatme.molit.service-key", () -> "test-key+/=");
    }

    @Autowired
    MockMvcTester mvc;

    @BeforeEach
    void resetFakeMolit() {
        molitBody.set(molitJson("\"\"")); // 기본은 "항공편 0개" 정상 응답
        molitStatus.set(200);
        molitDelayMs.set(0);
        molitCalls.set(0);
        molitLastQuery.set(null);
    }

    // ── 상황 ③ 잘못된 요청 → 400, 국토부에는 묻지 않음 ──

    @Test
    void 모르는_공항이면_400() {
        assertThat(search("ICN", "CJU", VALID_DATE)).hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY");
        assertThat(molitCalls.get()).isZero();
    }

    @Test
    void 출발과_도착이_같으면_400() {
        assertThat(search("GMP", "GMP", VALID_DATE)).hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY");
        assertThat(molitCalls.get()).isZero();
    }

    @Test
    void 지난_날짜면_400() {
        assertThat(search("GMP", "CJU", PAST_DATE)).hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY");
        assertThat(molitCalls.get()).isZero();
    }

    @Test
    void 날짜_모양이_틀리면_400() {
        assertThat(search("GMP", "CJU", "2026.11.13")).hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY");
        assertThat(molitCalls.get()).isZero();
    }

    @Test
    void 칸이_빠지면_400() {
        assertThat(mvc.get().uri("/api/flights").param("from", "GMP").param("to", "CJU"))
                .hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY");
        assertThat(molitCalls.get()).isZero();
    }

    // ── 정상 → 200, 명세서 모양으로 바꿔서 출발 시각 순으로 ──

    @Test
    void 국토부_응답을_명세서_모양으로_바꿔_출발_시각_순으로_돌려준다() {
        molitBody.set(molitJson("""
                [
                  {"airlineNm":"진에어","arrAirportNm":"제주","arrPlandTime":%1$s1545,"depAirportNm":"서울/김포","depPlandTime":%1$s1435,"economyCharge":100000,"prestigeCharge":0,"vihicleId":"LJ569"},
                  {"airlineNm":"제주항공","arrAirportNm":"제주","arrPlandTime":%1$s1520,"depAirportNm":"서울/김포","depPlandTime":%1$s1410,"economyCharge":0,"prestigeCharge":0,"vihicleId":"7C115"}
                ]""".formatted(VALID_DATE_MOLIT)));

        var result = search("GMP", "CJU", VALID_DATE);

        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.flights").asArray().hasSize(2);
        assertThat(result).bodyJson().extractingPath("$.flights[0].flightNumber").isEqualTo("7C115");
        assertThat(result).bodyJson().extractingPath("$.flights[0].airline").isEqualTo("제주항공");
        assertThat(result).bodyJson().extractingPath("$.flights[0].departureTime").isEqualTo("14:10");
        assertThat(result).bodyJson().extractingPath("$.flights[0].arrivalTime").isEqualTo("15:20");
        assertThat(result).bodyJson().extractingPath("$.flights[0].duration").isEqualTo("1시간 10분");
        // 기종 칸은 백엔드②가 채운다 — 지금은 상황 ④ "기종 모름"
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraft").isEqualTo("");
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("");
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapReady").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.flights[1].flightNumber").isEqualTo("LJ569");
    }

    @Test
    void 국토부에는_우리_공항_코드를_국토부_이름으로_바꿔_인증키와_함께_묻는다() {
        search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(molitCalls.get()).isEqualTo(1);
        assertThat(molitLastQuery.get())
                .contains("depAirportId=NAARKSS")
                .contains("arrAirportId=NAARKPC")
                .contains("depPlandTime=" + VALID_DATE_MOLIT)
                .contains("serviceKey=test-key%2B%2F%3D")
                .contains("_type=json");
    }

    @Test
    void 부산은_NAARKPK() {
        search("PUS", "CJU", VALID_DATE).exchange();

        assertThat(molitLastQuery.get()).contains("depAirportId=NAARKPK");
    }

    @Test
    void 인증키는_화면으로_나가지_않는다() {
        assertThat(search("GMP", "CJU", VALID_DATE)).hasStatusOk().bodyText().doesNotContain("test-key");
    }

    // ── 상황 ① 항공편 0개 → 200 빈 목록 (국토부는 이때 items를 빈 글자 ""로 준다) ──

    @Test
    void 항공편이_없으면_빈_목록() {
        assertThat(search("GMP", "CJU", VALID_DATE)).hasStatusOk().bodyJson().extractingPath("$.flights").asArray().isEmpty();
    }

    @Test
    void 항공편이_하나면_국토부는_목록_대신_항목_하나를_주는데_그래도_된다() {
        molitBody.set(molitJson("""
                {"airlineNm":"제주항공","arrPlandTime":%1$s1520,"depPlandTime":%1$s1410,"vihicleId":"7C115"}""".formatted(VALID_DATE_MOLIT)));

        assertThat(search("GMP", "CJU", VALID_DATE)).hasStatusOk().bodyJson().extractingPath("$.flights[0].flightNumber").isEqualTo("7C115");
    }

    // ── 상황 ② 국토부가 답이 없거나 오류 → 502 ──

    @Test
    void 국토부가_제한_시간_안에_답하지_않으면_502() {
        molitDelayMs.set(1500);

        assertThat(search("GMP", "CJU", VALID_DATE)).hasStatus(502).bodyJson().extractingPath("$.error").isEqualTo("UPSTREAM_UNAVAILABLE");
    }

    @Test
    void 국토부가_인증키_오류를_돌려주면_502() {
        molitStatus.set(403);
        molitBody.set("""
                {"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"errMsg":"SERVICE_KEY_IS_NOT_REGISTERED_ERROR","returnAuthMsg":"등록되지 않은 서비스키","returnReasonCode":"30"}}}""");

        assertThat(search("GMP", "CJU", VALID_DATE)).hasStatus(502).bodyJson().extractingPath("$.error").isEqualTo("UPSTREAM_UNAVAILABLE");
    }

    @Test
    void 국토부가_JSON이_아닌_것을_돌려주면_502() {
        molitBody.set("<html>점검 중</html>");

        assertThat(search("GMP", "CJU", VALID_DATE)).hasStatus(502).bodyJson().extractingPath("$.error").isEqualTo("UPSTREAM_UNAVAILABLE");
    }

    // ── 도우미 ──

    MockMvcRequestBuilder search(String from, String to, String date) {
        return mvc.get().uri("/api/flights").param("from", from).param("to", to).param("date", date);
    }

    /** 국토부 정상 응답 포장. items 자리에 목록(JSON 배열)·항목 하나(객체)·빈 글자("")를 그대로 넣는다. */
    static String molitJson(String items) {
        String body = items.equals("\"\"") ? "\"\"" : "{\"item\":" + items + "}";
        return """
                {"response":{"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},"body":{"items":%s,"numOfRows":500,"pageNo":1,"totalCount":2}}}"""
                .formatted(body);
    }

    static HttpServer startFakeMolit() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            server.setExecutor(Executors.newCachedThreadPool());
            server.createContext("/", exchange -> {
                molitCalls.incrementAndGet();
                molitLastQuery.set(exchange.getRequestURI().getRawQuery());
                try {
                    Thread.sleep(molitDelayMs.get());
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                byte[] body = molitBody.get().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json;charset=UTF-8");
                exchange.sendResponseHeaders(molitStatus.get(), body.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(body);
                }
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

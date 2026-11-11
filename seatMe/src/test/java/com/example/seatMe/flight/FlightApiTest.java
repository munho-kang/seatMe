package com.example.seatMe.flight;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.seatMe.aircraft.AircraftTypeService;
import com.example.seatMe.aircraft.KacAircraftResponse;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MockMvcTester.MockMvcRequestBuilder;

/**
 * 창구 GET /api/flights 확인. 국토부·공항공사 자리에는 이 테스트가 띄운 가짜 서버가 앉아 있다.
 * 요청 확인 규칙, 공항 코드 바꾸기, 편명 합치기, 그리고 상황 4가지:
 * ① 항공편 0개 → 200 빈 목록 · ② 국토부 실패 → 502 · ③ 잘못된 요청 → 400 · ④ 기종 모름 → 기종 칸만 비움.
 *
 * 항공편 한 개는 10칸이다 (이 창구의 약속은 이 주석이 전부다).
 * 앞 5칸은 국토부 답: airline(항공사 이름) · flightNumber · departureTime "14:10" · arrivalTime · duration.
 * 뒤 5칸은 공항공사 답과 좌석 배치도:
 *  - aircraft: 화면 이름 ("B738" → "B737-800"). 표에 없는 코드는 코드 그대로, 짝이 없으면 "".
 *  - aircraftCode: 공항공사 코드 ("B738"), 짝이 없으면 "".
 *  - seatMapReady: 편명 앞 두 글자(항공사) + 기종 코드의 배치도가 하나라도 있으면 true.
 *  - seatMaps: 후보 배치도 id 목록. 대표가 맨 앞이고, 없으면 [].
 *  - seatMapConfirmed: 후보가 정확히 하나로 정해졌으면 true (당일 편의 등록번호로 정해질 때 등).
 *    단, 항공사에 배치가 더 있는데 일부만 옮겨 적은 조합(파라타 A320)은 후보가 하나여도 false (등록번호로 정해질 때만 true).
 * 편명이 두 글자보다 짧거나 표에 없는 기종이어도 오류 없이 "배치도 없음"으로 나간다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class FlightApiTest {

    // 가짜 국토부 서버 — 테스트마다 돌려줄 응답(몸통·상태·지연)을 바꿔 끼운다
    static final AtomicReference<String> molitBody = new AtomicReference<>("");
    static final AtomicInteger molitStatus = new AtomicInteger(200);
    static final AtomicInteger molitDelayMs = new AtomicInteger(0);
    static final AtomicInteger molitCalls = new AtomicInteger(0);
    static final AtomicReference<String> molitLastQuery = new AtomicReference<>();

    // 가짜 공항공사 서버 — pageNo번째 쪽을 돌려주고, kacFailFromPage 쪽부터는 500으로 실패한다
    static final AtomicReference<List<String>> kacPages = new AtomicReference<>(List.of());
    static final AtomicInteger kacFailFromPage = new AtomicInteger(Integer.MAX_VALUE);
    static final AtomicInteger kacDelayMs = new AtomicInteger(0);
    static final AtomicInteger kacCalls = new AtomicInteger(0);
    static final AtomicReference<String> kacLastQuery = new AtomicReference<>();

    static final HttpServer MOLIT = startFakeServers();

    static final String VALID_DATE = LocalDate.now().plusDays(7).toString();
    static final String VALID_DATE_MOLIT = VALID_DATE.replace("-", ""); // 국토부는 20261113 모양
    static final String PAST_DATE = LocalDate.now().minusDays(1).toString();

    @DynamicPropertySource
    static void pointAtFakeMolit(DynamicPropertyRegistry registry) {
        registry.add("seatme.molit.base-url", () -> "http://localhost:" + MOLIT.getAddress().getPort());
        registry.add("seatme.molit.timeout-ms", () -> 300);
        registry.add("seatme.molit.service-key", () -> "test-key+/=");
        registry.add("kac.api.base-url", () -> "http://localhost:" + MOLIT.getAddress().getPort() + "/kac");
        registry.add("kac.api.timeout-ms", () -> 300);
        registry.add("kac.api.service-key", () -> "kac-test-key");
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
        kacPages.set(List.of());
        kacFailFromPage.set(Integer.MAX_VALUE);
        kacDelayMs.set(0);
        kacCalls.set(0);
        kacLastQuery.set(null);
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
    void 일년_넘게_먼_날짜면_400() {
        assertThat(search("GMP", "CJU", LocalDate.now().plusYears(2).toString())).hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY");
        assertThat(molitCalls.get()).isZero();
    }

    @Test
    void 연도가_다섯_자리여도_400() {
        assertThat(search("GMP", "CJU", "+12345-01-01")).hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY");
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

    // ── 정상 → 200, 화면 모양으로 바꿔서 출발 시각 순으로 ──

    @Test
    void 국토부_응답을_화면_모양으로_바꿔_출발_시각_순으로_돌려준다() {
        molitBody.set(molitJson("""
                [
                  {"airlineNm":"진에어","arrAirportNm":"제주","arrPlandTime":%1$s1545,"depAirportNm":"서울/김포","depPlandTime":%1$s1435,"economyCharge":100000,"prestigeCharge":0,"vihicleId":"LJ569"},
                  {"airlineNm":"제주 항공","arrAirportNm":"제주","arrPlandTime":%1$s1520,"depAirportNm":"서울/김포","depPlandTime":%1$s1410,"economyCharge":0,"prestigeCharge":0,"vihicleId":"7C115"}
                ]""".formatted(VALID_DATE_MOLIT)));

        var result = search("GMP", "CJU", VALID_DATE);

        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.flights").asArray().hasSize(2);
        assertThat(result).bodyJson().extractingPath("$.flights[0].flightNumber").isEqualTo("7C115");
        assertThat(result).bodyJson().extractingPath("$.flights[0].airline").isEqualTo("제주항공"); // 국토부의 "제주 항공" 띄어쓰기를 지운다
        assertThat(result).bodyJson().extractingPath("$.flights[0].departureTime").isEqualTo("14:10");
        assertThat(result).bodyJson().extractingPath("$.flights[0].arrivalTime").isEqualTo("15:20");
        assertThat(result).bodyJson().extractingPath("$.flights[0].duration").isEqualTo("1시간 10분");
        // 이 테스트의 가짜 공항공사는 기록이 없다 — 상황 ④ "기종 모름"
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

    // ── 편명 합치기 ──

    @Test
    void 배치도가_있는_기종은_화면_이름을_붙이고_추천_가능으로_표시한다() {
        twoMolitFlights();
        kacPages.set(List.of(kacPage(1, kacItem("7C115", "1410", "O", "GMP", "CJU", "B738"))));

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraft").isEqualTo("B737-800");
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("B738");
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapReady").isEqualTo(true);
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMaps").asArray()
                .containsExactlyInAnyOrder("7C-B738-189", "7C-B738-174");
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapConfirmed").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.flights[0]").asMap().hasSize(10);
    }

    @Test
    void 배치도가_없는_기종은_코드를_이름으로_쓰고_준비_중으로_표시한다() {
        twoMolitFlights();
        kacPages.set(List.of(kacPage(1, kacItem("7C115", "1410", "O", "GMP", "CJU", "A321"))));

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraft").isEqualTo("A321");
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("A321");
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapReady").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMaps").asArray().isEmpty();
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapConfirmed").isEqualTo(false);
    }

    @Test
    void 짝이_없는_편명은_기종만_비우고_목록에_남는다() {
        twoMolitFlights();
        kacPages.set(List.of(kacPage(1, kacItem("7C115", "1410", "O", "GMP", "CJU", "B738"))));

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).bodyJson().extractingPath("$.flights[1].flightNumber").isEqualTo("LJ569");
        assertThat(result).bodyJson().extractingPath("$.flights[1].aircraft").isEqualTo("");
        assertThat(result).bodyJson().extractingPath("$.flights[1].aircraftCode").isEqualTo("");
        assertThat(result).bodyJson().extractingPath("$.flights[1].seatMapReady").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.flights[1].seatMaps").asArray().isEmpty();
        assertThat(result).bodyJson().extractingPath("$.flights[1].seatMapConfirmed").isEqualTo(false);
    }

    @Test void 같은_기종이어도_배치도가_없는_항공사는_준비_중이다() {
        molitBody.set(molitJson("""
                {"airlineNm":"없는항공","arrPlandTime":%1$s1520,"depPlandTime":%1$s1410,"vihicleId":"XX101"}""".formatted(VALID_DATE_MOLIT)));
        kacPages.set(List.of(kacPage(1, kacItem("XX101", "1410", "O", "GMP", "CJU", "B738"))));
        var result = search("GMP", "CJU", VALID_DATE).exchange();
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraft").isEqualTo("B737-800");
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapReady").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMaps").asArray().isEmpty();
    }
    @Test void 편명이_이상하거나_모르는_기종이어도_오류_없이_배치도_없음() {
        molitBody.set(molitJson("""
                [
                  {"airlineNm":"제주항공","arrPlandTime":%1$s1520,"depPlandTime":%1$s1410,"vihicleId":"7"},
                  {"airlineNm":"제주항공","arrPlandTime":%1$s1545,"depPlandTime":%1$s1435,"vihicleId":"7C117"}
                ]""".formatted(VALID_DATE_MOLIT)));
        kacPages.set(List.of(kacPage(2,
                kacItem("7", "1410", "O", "GMP", "CJU", "B738"), kacItem("7C117", "1435", "O", "GMP", "CJU", "B789"))));
        var result = search("GMP", "CJU", VALID_DATE).exchange();
        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMaps").asArray().isEmpty();
        assertThat(result).bodyJson().extractingPath("$.flights[1].aircraft").isEqualTo("B789"); // 표에 없으면 코드 그대로
        assertThat(result).bodyJson().extractingPath("$.flights[1].seatMapReady").isEqualTo(false);
    }
    @Test void 배치가_여럿인_기종은_후보를_전부_주고_확정하지_않는다() {
        molitBody.set(molitJson("""
                {"airlineNm":"대한항공","arrPlandTime":%1$s1520,"depPlandTime":%1$s1410,"vihicleId":"KE1203"}""".formatted(VALID_DATE_MOLIT)));
        kacPages.set(List.of(kacPage(1, kacItem("KE1203", "1410", "O", "GMP", "CJU", "A333"))));
        var result = search("GMP", "CJU", VALID_DATE).exchange();
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMaps").asArray()
                .containsExactly("KE-A333-272", "KE-A333-284", "KE-A333-276", "KE-A333-298", "KE-A333-290");
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapConfirmed").isEqualTo(false);
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraft").isEqualTo("A330-300");
    }
    @Test void 당일_편의_등록번호가_배치에_있으면_하나로_확정한다() {
        molitBody.set(molitJson("""
                {"airlineNm":"에어부산","arrPlandTime":%1$s1520,"depPlandTime":%1$s1410,"vihicleId":"BX8111"}""".formatted(VALID_DATE_MOLIT)));
        kacPages.set(List.of(kacPage(1, kacItem("BX8111", "1410", "O", "GMP", "CJU", "A321", "HL8099"))));
        var result = search("GMP", "CJU", VALID_DATE).exchange();
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMaps").asArray().containsExactly("BX-A321-HL8099");
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapConfirmed").isEqualTo(true);

        kacPages.set(List.of(kacPage(1, kacItem("BX8111", "1410", "O", "GMP", "CJU", "A321")))); // 모르는 번호 HL0000
        var unknown = search("GMP", "CJU", VALID_DATE).exchange();
        assertThat(unknown).bodyJson().extractingPath("$.flights[0].seatMaps").asArray().hasSizeGreaterThan(1);
        assertThat(unknown).bodyJson().extractingPath("$.flights[0].seatMapConfirmed").isEqualTo(false);
    }
    @Test void 배치가_하나뿐인_기종은_확정이다() {
        molitBody.set(molitJson("""
                {"airlineNm":"티웨이항공","arrPlandTime":%1$s1520,"depPlandTime":%1$s1410,"vihicleId":"TW701"}""".formatted(VALID_DATE_MOLIT)));
        kacPages.set(List.of(kacPage(1, kacItem("TW701", "1410", "O", "GMP", "CJU", "B738"))));
        var result = search("GMP", "CJU", VALID_DATE).exchange();
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMaps").asArray().containsExactly("TW-B738-189");
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapConfirmed").isEqualTo(true);
    }
    @Test void 빠진_배치가_있는_조합은_후보가_하나여도_확정하지_않는다() {
        molitBody.set(molitJson("""
                {"airlineNm":"파라타항공","arrPlandTime":%1$s1520,"depPlandTime":%1$s1410,"vihicleId":"WE501"}""".formatted(VALID_DATE_MOLIT)));
        kacPages.set(List.of(kacPage(1, kacItem("WE501", "1410", "O", "GMP", "CJU", "A320"))));
        var result = search("GMP", "CJU", VALID_DATE).exchange();
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMaps").asArray().containsExactly("WE-A320-174");
        assertThat(result).bodyJson().extractingPath("$.flights[0].seatMapConfirmed").isEqualTo(false);
    }
    @Test void 가장_가까운_기록의_등록번호도_함께_넘긴다() {
        var morning = new KacAircraftResponse.Item("BX8111", "202611100745", "O", "GMP", "CJU", "A321", "HL8099");
        var evening = new KacAircraftResponse.Item("BX8111", "202611101830", "O", "GMP", "CJU", "A321", "HL7729");
        assertThat(AircraftTypeService.nearestRecord(List.of(evening, morning), "08:00").aplRegNo()).isEqualTo("HL8099");
        assertThat(AircraftTypeService.nearestRecord(null, "08:00")).isNull();
    }

    @Test
    void 편명이_같아도_다른_노선이나_도착_기록의_기종은_쓰지_않는다() {
        twoMolitFlights();
        kacPages.set(List.of(kacPage(2,
                kacItem("7C115", "1410", "I", "GMP", "CJU", "B738"),   // 김포 도착 기록
                kacItem("LJ569", "1435", "O", "GMP", "PUS", "B738")))); // 김포→부산

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("");
        assertThat(result).bodyJson().extractingPath("$.flights[1].aircraftCode").isEqualTo("");
    }

    @Test
    void 공항공사_시각이_국토부와_달라도_같은_편명이면_합친다() {
        twoMolitFlights();
        kacPages.set(List.of(kacPage(1, kacItem("7C115", "1345", "O", "GMP", "CJU", "B738"))));

        assertThat(search("GMP", "CJU", VALID_DATE)).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("B738");
    }

    @Test
    void 같은_편명이_하루_두_번이면_출발_시각이_가장_가까운_기록의_기종을_쓴다() {
        molitBody.set(molitJson("""
                [
                  {"airlineNm":"대한항공","arrPlandTime":%1$s0910,"depPlandTime":%1$s0800,"vihicleId":"KE1505"},
                  {"airlineNm":"대한항공","arrPlandTime":%1$s2010,"depPlandTime":%1$s1900,"vihicleId":"KE1505"}
                ]""".formatted(VALID_DATE_MOLIT)));
        kacPages.set(List.of(kacPage(2,
                kacItem("KE1505", "1830", "O", "GMP", "CJU", "A321"),    // 저녁 편 (30분 차이)
                kacItem("KE1505", "0745", "O", "GMP", "CJU", "B738")))); // 아침 편 (15분 차이)

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("B738");
        assertThat(result).bodyJson().extractingPath("$.flights[1].aircraftCode").isEqualTo("A321");
    }

    @Test
    void 공항공사_기록이_여러_쪽이면_끝까지_읽고_더_묻지_않는다() {
        twoMolitFlights();
        kacPages.set(List.of(
                kacPage(2, kacItem("7C115", "1410", "O", "GMP", "CJU", "B738")),
                kacPage(2, kacItem("LJ569", "1435", "O", "GMP", "CJU", "A321"))));

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("B738");
        assertThat(result).bodyJson().extractingPath("$.flights[1].aircraftCode").isEqualTo("A321");
        assertThat(kacCalls.get()).isEqualTo(2);
    }

    @Test
    void 공항공사에는_출발_공항과_그날_하루를_묻는다() {
        twoMolitFlights();

        search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(kacLastQuery.get())
                .contains("schAirCode=GMP")
                .contains("schStTime=" + VALID_DATE_MOLIT + "0000")
                .contains("schEdTime=" + VALID_DATE_MOLIT + "2359")
                .contains("numOfRows=100"); // 공항공사는 100을 넘으면 오류를 돌려준다
    }

    @Test
    void 항공편이_없으면_공항공사에_묻지_않는다() {
        search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(kacCalls.get()).isZero();
    }

    // ── 공항공사만 답이 없어도 오류로 끝내지 않는다 ──

    @Test
    void 공항공사가_오류를_돌려주면_시각은_보여주고_기종만_비운다() {
        twoMolitFlights();
        kacPages.set(List.of(kacPage(1, kacItem("7C115", "1410", "O", "GMP", "CJU", "B738"))));
        kacFailFromPage.set(1);

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.flights").asArray().hasSize(2);
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("");
    }

    @Test
    void 공항공사가_제한_시간_안에_답하지_않으면_시각은_보여주고_기종만_비운다() {
        twoMolitFlights();
        kacPages.set(List.of(kacPage(1, kacItem("7C115", "1410", "O", "GMP", "CJU", "B738"))));
        kacDelayMs.set(1500);

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.flights[0].flightNumber").isEqualTo("7C115");
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("");
        assertThat(kacCalls.get()).isEqualTo(1); // 한 번 시간을 넘기면 다음 쪽을 더 기다리지 않는다
    }

    @Test
    void 중간_쪽에서_실패해도_앞서_받은_기종은_쓴다() {
        twoMolitFlights();
        kacPages.set(List.of(
                kacPage(2, kacItem("7C115", "1410", "O", "GMP", "CJU", "B738")),
                kacPage(2, kacItem("LJ569", "1435", "O", "GMP", "CJU", "A321"))));
        kacFailFromPage.set(2);

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("B738");
        assertThat(result).bodyJson().extractingPath("$.flights[1].aircraftCode").isEqualTo("");
    }

    @Test
    void 공항공사가_실패해도_인증키는_응답과_기록_어디에도_나가지_않는다(CapturedOutput output) {
        twoMolitFlights();
        kacFailFromPage.set(1);

        assertThat(search("GMP", "CJU", VALID_DATE)).hasStatusOk().bodyText().doesNotContain("kac-test-key");
        assertThat(output).doesNotContain("kac-test-key");
    }

    @Test
    void 공항공사가_HTTP_200으로_오류를_주면_기록에_오류_이름을_남긴다(CapturedOutput output) {
        twoMolitFlights();
        kacPages.set(List.of("""
                {"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"errMsg":"LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR","returnReasonCode":"22"}}}"""));

        var result = search("GMP", "CJU", VALID_DATE).exchange();

        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.flights").asArray().hasSize(2);
        assertThat(result).bodyJson().extractingPath("$.flights[0].aircraftCode").isEqualTo("");
        assertThat(output).contains("LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR").doesNotContain("kac-test-key");
    }

    // ── 오늘 검색이면 이미 떠난 편은 뺀다 ──

    static final LocalDateTime TODAY_2PM = LocalDateTime.of(2026, 11, 9, 14, 0);
    static final List<Flight> ONE_PM_AND_THREE_PM = List.of(
            new Flight("제주항공", "7C101", "13:00", "14:10", "1시간 10분", "", "", false, List.of(), false),
            new Flight("진에어", "LJ303", "15:00", "16:10", "1시간 10분", "", "", false, List.of(), false));

    @Test
    void 오늘_14시면_13시_편은_빠지고_15시_편은_남는다() {
        assertThat(FlightController.notDeparted(ONE_PM_AND_THREE_PM, TODAY_2PM.toLocalDate(), TODAY_2PM))
                .extracting(Flight::flightNumber).containsExactly("LJ303");
    }

    @Test
    void 내일_날짜면_아무것도_빼지_않는다() {
        assertThat(FlightController.notDeparted(ONE_PM_AND_THREE_PM, TODAY_2PM.toLocalDate().plusDays(1), TODAY_2PM))
                .hasSize(2);
    }

    @Test
    void 오늘_편이_전부_떠났으면_빈_목록() {
        LocalDateTime night = TODAY_2PM.withHour(23);
        assertThat(FlightController.notDeparted(ONE_PM_AND_THREE_PM, night.toLocalDate(), night)).isEmpty();
    }

    // ── 도우미 ──

    /** 국토부 정상 응답: 14:10 7C115, 14:35 LJ569 */
    void twoMolitFlights() {
        molitBody.set(molitJson("""
                [
                  {"airlineNm":"제주항공","arrPlandTime":%1$s1520,"depPlandTime":%1$s1410,"vihicleId":"7C115"},
                  {"airlineNm":"진에어","arrPlandTime":%1$s1545,"depPlandTime":%1$s1435,"vihicleId":"LJ569"}
                ]""".formatted(VALID_DATE_MOLIT)));
    }

    /** 공항공사 기록 한 건 — 실제 응답의 칸을 그대로 갖췄다. */
    static String kacItem(String flightNo, String hhmm, String io, String airport, String city, String code) {
        return kacItem(flightNo, hhmm, io, airport, city, code, "HL0000");
    }

    static String kacItem(String flightNo, String hhmm, String io, String airport, String city, String code, String reg) {
        return """
                {"airFln":"%s","airlineEnglish":"AIRLINE","airlineKorean":"항공사","airport":"%s","aplRegNo":"%s","arrivedEng":"","arrivedKor":"","boardingEng":"","boardingKor":"","cdsrYn":"N","city":"%s","etd":"","fid":"","gate":"1","icaoApmCd":"%s","io":"%s","line":"국내","rmkEng":"","rmkKor":"","std":"%s%s"}"""
                .formatted(flightNo, airport, reg, city, code, io, VALID_DATE_MOLIT, hhmm);
    }

    /** 공항공사 정상 응답 한 쪽. totalCount는 모든 쪽을 합친 기록 수. */
    static String kacPage(int totalCount, String... items) {
        return """
                {"response":{"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},"body":{"numOfRows":100,"pageNo":1,"totalCount":%d,"items":{"item":[%s]}}}}"""
                .formatted(totalCount, String.join(",", items));
    }

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

    static HttpServer startFakeServers() {
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
            server.createContext("/kac", exchange -> {
                kacCalls.incrementAndGet();
                String query = exchange.getRequestURI().getRawQuery();
                kacLastQuery.set(query);
                try {
                    Thread.sleep(kacDelayMs.get());
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                Matcher pageNo = Pattern.compile("pageNo=(\\d+)").matcher(query);
                int page = pageNo.find() ? Integer.parseInt(pageNo.group(1)) : 1;
                List<String> pages = kacPages.get();
                byte[] body = (page <= pages.size() ? pages.get(page - 1) : kacPage(0)).getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json;charset=UTF-8");
                exchange.sendResponseHeaders(page >= kacFailFromPage.get() ? 500 : 200, body.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(body);
                } catch (IOException ignored) {
                    // 서버가 시간 초과로 먼저 끊은 경우
                }
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

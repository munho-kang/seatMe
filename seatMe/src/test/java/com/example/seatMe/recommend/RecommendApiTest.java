package com.example.seatMe.recommend;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.seatMe.seatmap.SeatMap;
import com.example.seatMe.seatmap.SeatMapRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

/**
 * 창구 GET /api/recommend 확인 (추천 창구의 규칙은 이 주석이 기준이다). 계산만 하고 공공데이터는 부르지 않는다.
 *
 * 받는 칸 — 화면이 항공편을 고를 때 /api/flights에서 받은 값과 취향을 그대로 실어 보낸다:
 *  - from · to · date: /api/flights와 같은 규칙 (공항 GMP · CJU · PUS, 날짜는 오늘 ~ 1년 뒤).
 *  - flight: 편명 (앞 두 글자가 항공사). dep · arr: "HH:mm" 한국 시각. aircraftCode: 공항공사 기종 코드.
 *    도착이 출발보다 이르면 다음 날 도착으로 세고, 그렇게 센 비행 시간이 3시간을 넘으면 틀린 값이다.
 *  - seatMap: 계산에 쓸 배치도 id. 그 항공사 + 기종의 후보 중 하나여야 한다.
 *  - sunlight · view · quietness · turbulence · quickExit: 1~5 정수 (1은 "전혀 신경 안 씀").
 *  - seatPosition: always-aisle · prefer-aisle · any · prefer-window · always-window.
 *
 * 200 {aircraft, seatMapId, sun{left, right}, seats[3]}:
 *  - aircraft: 기종 화면 이름. seatMapId: 계산에 쓴 배치도 (좌석 목록은 /api/seatmaps/{id}로 따로 받는다).
 *  - sun: 비행 중 왼쪽 · 오른쪽 창의 햇빛 세기 0~1.
 *  - seats: 일반석 TOP 3 {rank, seat, score, scores, features, tradeoff}.
 *    score는 0~100 정수. scores는 항목별 점수 0~1 (sunlight · view · quietness · turbulence · quickExit · position).
 *    날개 위치를 모르는 배치는 scores.turbulence가 null이다 (계산에서 뺀 것이지 0점이 아니다).
 *    features는 잘 맞는 항목 이름(점수 0.7 이상, 최대 4개, 없으면 []), tradeoff는 가장 아쉬운 항목 이름(점수 0.7 미만 중 하나, 없으면 null).
 *    같은 항목이 양쪽에 나오지 않고, 모르는 정보(null)로 매긴 항목은 어느 쪽에도 나오지 않는다. 문구는 화면이 만든다.
 *
 * 오류: 값이 틀리거나 빠지면 400 {"error": "INVALID_QUERY"} (seatMap이 그 편의 후보가 아닐 때도).
 * 그 항공사 + 기종의 배치도가 하나도 없으면 404 {"error": "SEAT_MAP_NOT_READY"} (기종을 모르는 편도 여기).
 */
@SpringBootTest
@AutoConfigureMockMvc
class RecommendApiTest {

    static final String DAY = LocalDate.now().plusDays(7).toString();

    @Autowired MockMvcTester mvc;
    @Autowired SeatMapRepository seatMaps;

    @Test void 일반석_TOP_3를_돌려준다() {
        var result = recommend(Map.of());

        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$").asMap().containsOnlyKeys("aircraft", "seatMapId", "sun", "seats");
        assertThat(result).bodyJson().extractingPath("$.aircraft").isEqualTo("B737-800");
        assertThat(result).bodyJson().extractingPath("$.seatMapId").isEqualTo("7C-B738-189");
        assertThat(result).bodyJson().extractingPath("$.seats[*].rank").asArray().containsExactly(1, 2, 3);
        assertThat(result).bodyJson().extractingPath("$.seats[0]").asMap()
                .containsOnlyKeys("rank", "seat", "score", "scores", "features", "tradeoff");
        assertThat(result).bodyJson().extractingPath("$.seats[0].scores").asMap()
                .containsOnlyKeys("sunlight", "view", "quietness", "turbulence", "quickExit", "position");
        assertThat(result).bodyJson().extractingPath("$.seats[0].score").asNumber().satisfies(n -> assertThat(n.intValue()).isBetween(0, 100));
    }

    @Test void 오후_편은_가는_방향에_따라_해가_드는_쪽과_추천_좌석의_좌우가_반대다() {
        var south = recommend(Map.of()); // 김포→제주 14:10, 해는 서쪽(오른쪽)
        assertThat(south).bodyJson().extractingPath("$.sun.left").isEqualTo(0.0);
        assertThat(south).bodyJson().extractingPath("$.sun.right").asNumber().satisfies(n -> assertThat(n.doubleValue()).isGreaterThan(0.2));
        assertThat(south).bodyJson().extractingPath("$.seats[0].seat").asString().endsWith("A");

        var north = recommend(Map.of("from", "CJU", "to", "GMP"));
        assertThat(north).bodyJson().extractingPath("$.sun.right").isEqualTo(0.0);
        assertThat(north).bodyJson().extractingPath("$.sun.left").asNumber().satisfies(n -> assertThat(n.doubleValue()).isGreaterThan(0.2));
        assertThat(north).bodyJson().extractingPath("$.seats[0].seat").asString().endsWith("F");
    }

    @Test void 같은_편명도_시각이_다르면_햇빛이_다르다() {
        var morning = recommend(Map.of("dep", "09:00", "arr", "10:10")); // 오전에는 해가 동쪽(왼쪽)
        assertThat(morning).bodyJson().extractingPath("$.sun.left").asNumber().satisfies(n -> assertThat(n.doubleValue()).isGreaterThan(0.2));
        assertThat(morning).bodyJson().extractingPath("$.sun.right").isEqualTo(0.0);

        var night = recommend(Map.of("dep", "22:00", "arr", "23:10"));
        assertThat(night).bodyJson().extractingPath("$.sun.left").isEqualTo(0.0);
        assertThat(night).bodyJson().extractingPath("$.sun.right").isEqualTo(0.0);
    }

    @Test void 햇빛을_신경_안_쓰면_좌우_점수_차이가_없다() {
        var result = recommend(Map.of("sunlight", "1"));

        // 같은 열의 왼쪽 창가와 오른쪽 창가가 같은 점수로 나란히 온다
        assertThat(result).bodyJson().extractingPath("$.seats[0].seat").asString().endsWith("A");
        assertThat(result).bodyJson().extractingPath("$.seats[1].seat").asString().endsWith("F");
        assertThat(result).bodyJson().extractingPath("$.seats[*].score").asArray()
                .satisfies(scores -> assertThat(scores[1]).isEqualTo(scores[0]));
    }

    @Test void 날개_위치를_모르는_배치는_흔들림_점수가_null이다() {
        var result = recommend(Map.of("flight", "ZE201", "seatMap", "ZE-B738-189"));

        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.seats[0].scores").asMap().containsEntry("turbulence", null);
        assertThat(result).bodyJson().extractingPath("$.seats[*].features[*]").asArray().doesNotContain("turbulence");
    }

    @Test void 모든_배치도에서_오류_없이_세_좌석이_나온다() {
        var profile = new SeatScorer.Preferences(5, 3, 4, 4, 2, "prefer-window");
        for (SeatMap map : seatMaps.all()) {
            assertThat(SeatScorer.rank(map, new Sun(0.3, 0), profile)).as(map.id()).hasSizeGreaterThanOrEqualTo(3);
        }
    }

    @Test void 값이_틀리거나_빠지면_400() {
        Map<String, String> wrong = new LinkedHashMap<>();
        wrong.put("from", "ICN");
        wrong.put("to", "GMP"); // 출발과 같다
        wrong.put("date", LocalDate.now().minusDays(1).toString());
        wrong.put("flight", "7C");
        wrong.put("dep", "9:00");
        wrong.put("arr", "25:00");
        wrong.put("sunlight", "0");
        wrong.put("view", "6");
        wrong.put("quietness", "abc");
        wrong.put("turbulence", "2.5");
        wrong.put("quickExit", "");
        wrong.put("seatPosition", "window");
        wrong.put("seatMap", "KE-A321-174"); // 있는 배치도지만 이 편(제주항공 B738)의 후보가 아니다
        wrong.forEach((key, value) -> assertThat(recommend(Map.of(key, value))).as(key + "=" + value)
                .hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY"));

        for (String key : wrong.keySet()) {
            Map<String, String> missing = new LinkedHashMap<>();
            missing.put(key, null);
            assertThat(recommend(missing)).as(key + " 없음")
                    .hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY");
        }
    }

    @Test void 비행_시간이_3시간을_넘으면_400() {
        for (String arr : List.of("13:00", "14:10", "17:11")) { // 출발 14:10보다 이르거나 같으면 다음 날 도착으로 센다
            assertThat(recommend(Map.of("arr", arr))).as("arr=" + arr)
                    .hasStatus(400).bodyJson().extractingPath("$.error").isEqualTo("INVALID_QUERY");
        }
        assertThat(recommend(Map.of("dep", "23:30", "arr", "00:40"))).hasStatusOk(); // 자정을 넘기는 1시간 10분
    }

    @Test void 배치도가_없는_항공사와_기종이면_404() {
        for (Map<String, String> change : List.of(
                Map.of("aircraftCode", "A321"), // 제주항공 A321은 배치도가 없다
                Map.of("aircraftCode", ""), // 기종을 모르는 편
                Map.of("flight", "XX123"))) {
            assertThat(recommend(change)).as(change.toString())
                    .hasStatus(404).bodyJson().extractingPath("$.error").isEqualTo("SEAT_MAP_NOT_READY");
        }
    }

    /** 김포→제주 제주항공 7C115 14:10~15:20 B738 + 기본 취향에서, change의 칸만 바꾸거나(null이면 빼고) 부른다. */
    private MvcTestResult recommend(Map<String, String> change) {
        Map<String, String> query = new LinkedHashMap<>();
        query.put("from", "GMP");
        query.put("to", "CJU");
        query.put("date", DAY);
        query.put("flight", "7C115");
        query.put("dep", "14:10");
        query.put("arr", "15:20");
        query.put("aircraftCode", "B738");
        query.put("seatMap", "7C-B738-189");
        query.put("sunlight", "5");
        query.put("view", "3");
        query.put("quietness", "4");
        query.put("turbulence", "4");
        query.put("quickExit", "2");
        query.put("seatPosition", "prefer-window");
        query.putAll(change);
        var request = mvc.get().uri("/api/recommend");
        query.forEach((key, value) -> {
            if (value != null) request.param(key, value);
        });
        return request.exchange();
    }
}

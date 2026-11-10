package com.example.seatMe.seatmap;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

/**
 * 창구 GET /api/seatmaps 확인 (화면이 부르는 좌석 배치도 창구의 규칙은 이 주석이 기준이다).
 * - GET /api/seatmaps/{id}: 200, 배치도 하나를 그대로 돌려준다.
 *   {id, airline, aircraft, name, seatCount, source, checkedOn, cabins[{class, fromRow, toRow, seats}], seats[...], facilities[...]}.
 *   좌석 하나는 {seat, row, column, cabin, side, position, hasWindow, overWing, exitRow, zone, nearLavatory, noRecline, extraLegroom}.
 *   항공사가 공개하지 않은 특징("모름")은 null로 나가고, 칸 이름(키)은 그대로 남는다.
 * - 없는 id · 소문자 id · 아주 긴 id → 404 {"error": "SEAT_MAP_NOT_FOUND"} (500이 아니다).
 * - GET /api/seatmaps: 200 {"seatMaps": [{id, airline, aircraft, name, seatCount}]} — 요약만, 항공사 → 순서 → id 차례.
 * - /seatmaps.html: 확인용 미리보기 화면. 위 두 창구로 어떤 배치도든 그려서 항공사 공식 그림과 눈으로 비교한다 (#<id>로 바로 열림).
 */
@SpringBootTest
@AutoConfigureMockMvc
class SeatMapApiTest {

    @Autowired MockMvcTester mvc;

    @Test void 배치도_하나를_돌려준다() {
        var result = mvc.get().uri("/api/seatmaps/7C-B738-189").exchange();
        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$").asMap().containsOnlyKeys(
                "id", "airline", "aircraft", "name", "seatCount", "source", "checkedOn", "cabins", "seats", "facilities");
        assertThat(result).bodyJson().extractingPath("$.airline").isEqualTo("7C");
        assertThat(result).bodyJson().extractingPath("$.aircraft").isEqualTo("B737-800");
        assertThat(result).bodyJson().extractingPath("$.seatCount").isEqualTo(189);
        assertThat(result).bodyJson().extractingPath("$.seats").asArray().hasSize(189);
        assertThat(result).bodyJson().extractingPath("$.seats[0]").asMap().containsOnlyKeys(   // 모름(null)이어도 칸은 나간다
                "seat", "row", "column", "cabin", "side", "position", "hasWindow", "overWing",
                "exitRow", "zone", "nearLavatory", "noRecline", "extraLegroom");
        assertThat(result).bodyJson().extractingPath("$.cabins[0]").asMap().containsOnlyKeys("class", "fromRow", "toRow", "seats");
    }

    @Test void 미리보기_화면이_열린다() {
        assertThat(mvc.get().uri("/seatmaps.html")).hasStatusOk().bodyText().contains("/api/seatmaps");
    }

    @Test void 없는_id면_404() {
        for (String id : List.of("NOPE", "7c-b738-189", "X".repeat(300))) {
            assertThat(mvc.get().uri("/api/seatmaps/{id}", id)).hasStatus(404)
                    .bodyJson().extractingPath("$.error").isEqualTo("SEAT_MAP_NOT_FOUND");
        }
    }

    @Test void 목록은_요약만_돌려준다() {
        var result = mvc.get().uri("/api/seatmaps").exchange();
        assertThat(result).hasStatusOk();
        assertThat(result).bodyJson().extractingPath("$.seatMaps[*].id").asArray().contains("7C-B738-189", "7C-B38M-174");
        assertThat(result).bodyJson().extractingPath("$.seatMaps[0]").asMap()
                .containsOnlyKeys("id", "airline", "aircraft", "name", "seatCount");
    }
}

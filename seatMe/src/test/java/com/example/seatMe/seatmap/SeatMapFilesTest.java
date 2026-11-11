package com.example.seatMe.seatmap;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 실제 배치도 파일(seatmaps/*.json)을 스프링 없이 읽어 검사한다. */
class SeatMapFilesTest {

    static final JsonMapper JSON = JsonMapper.builder().build();
    static final SeatMapRepository REPO = new SeatMapRepository(JSON);

    /** 화면에 뜨는 "항공사 기종 코드" 조합. 항공사를 옮겨 적을 때마다 줄을 더한다. */
    static final List<String> EXPECTED_COMBOS = List.of("7C B738", "7C B38M", "LJ B738", "LJ B38M", "LJ B739", "LJ B772", "LJ A321", "KE B739", "KE BCS3", "KE A21N", "KE A333", "BX A321", "BX A320", "BX A21N", "ZE B738", "ZE B38M");

    @Test void 우리_노선의_조합마다_배치도가_있다() {
        assertThat(EXPECTED_COMBOS).allSatisfy(combo ->
                assertThat(REPO.candidatesFor(combo.split(" ")[0], combo.split(" ")[1], null).ids()).as(combo).isNotEmpty());
    }
    @Test void 좌석_수가_공식_좌석_수와_같다() {            // officialSeats가 null인 파일은 건너뛴다
        assertThat(REPO.files()).filteredOn(f -> f.officialSeats() != null).allSatisfy(f ->
                assertThat(f.officialSeats()).as(f.id()).contains(REPO.findById(f.id()).orElseThrow().seatCount()));
    }

    static final List<String> KEYS = List.of("id", "airline", "aircraftCodes", "name", "order", "officialSeats", "registrations",
            "source", "checkedOn", "cabins", "exitRows", "extraLegroom", "overWing", "noWindow", "noRecline", "facilities");

    @Test void 칸_이름이_정해진_것뿐이고_모름_칸도_꼭_적혀_있다() throws IOException {   // 빠져도, 더 있어도 실패
        for (Resource file : new PathMatchingResourcePatternResolver().getResources("classpath*:seatmaps/*.json")) {
            JsonNode root = JSON.readTree(file.getInputStream());
            assertThat(root.propertyNames()).as(file.getFilename()).containsExactlyInAnyOrderElementsOf(KEYS);
            root.path("cabins").forEach(cabin -> assertThat(cabin.propertyNames()).as(file.getFilename())
                    .contains("class", "fromRow", "toRow", "seats").isSubsetOf("class", "fromRow", "toRow", "seats", "missing"));
            root.path("facilities").forEach(facility -> assertThat(facility.propertyNames()).as(file.getFilename())
                    .containsExactlyInAnyOrder("type", "afterRow", "side"));
            if (root.path("overWing").isObject())   // torow 같은 잘못 쓴 칸이 조용히 무시되지 않게
                assertThat(root.path("overWing").propertyNames()).as(file.getFilename())
                        .containsExactlyInAnyOrder("fromRow", "toRow");
        }
    }
    @Test void 출처는_https_주소이고_확인_날짜는_날짜다() {
        assertThat(REPO.files()).allSatisfy(f -> {
            assertThat(f.source()).as(f.id()).startsWith("https://");
            assertThat(LocalDate.parse(f.checkedOn())).as(f.id()).isBeforeOrEqualTo(LocalDate.now());
        });
    }
    @Test void 등록번호는_HL과_숫자_네_개다() {   // 소문자나 공백이 섞이면 조용히 "확정 안 됨"이 된다
        assertThat(REPO.files()).allSatisfy(f ->
                assertThat(f.registrations()).as(f.id()).allMatch(r -> r.matches("HL\\d{4}")));
    }
    @Test void 같은_항공사_기종의_후보는_서로_다르다() {   // 똑같으면 "합치기" 규칙대로 합친다
        for (SeatMapFile a : REPO.files()) {
            for (SeatMapFile b : REPO.files()) {
                if (a.id().compareTo(b.id()) < 0 && a.airline().equals(b.airline())
                        && !Collections.disjoint(a.aircraftCodes(), b.aircraftCodes())) {
                    SeatMap x = REPO.findById(a.id()).orElseThrow(), y = REPO.findById(b.id()).orElseThrow();
                    assertThat(List.of(x.cabins(), x.seats(), x.facilities())).as(a.id() + " = " + b.id())
                            .isNotEqualTo(List.of(y.cabins(), y.seats(), y.facilities()));
                }
            }
        }
    }
}

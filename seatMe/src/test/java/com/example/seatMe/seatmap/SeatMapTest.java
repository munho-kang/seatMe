package com.example.seatMe.seatmap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import com.example.seatMe.aircraft.AircraftNames;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

// 배치도 파일(짧은 설명)이 좌석 목록으로 펼쳐지는 규칙과, 틀린 파일이 읽을 때 멈추는 것을 확인한다.
class SeatMapTest {

    static final JsonMapper JSON = JsonMapper.builder().build();

    static SeatMap map(String json) {
        return SeatMap.from(JSON.readValue(json, SeatMapFile.class));
    }

    static SeatMap.Seat seat(SeatMap m, String id) {
        return m.seats().stream().filter(s -> s.seat().equals(id)).findFirst().orElseThrow();
    }

    /** base의 맨 위 칸 하나만 바꾼 JSON. */
    static String with(String base, String key, String rawJson) {
        ObjectNode node = (ObjectNode) JSON.readTree(base);
        node.set(key, JSON.readTree(rawJson));
        return JSON.writeValueAsString(node);
    }

    static String with(String key, String rawJson) {
        return with(BASE, key, rawJson);
    }

    static final String BASE = """
        { "id": "XX-B738-31", "airline": "XX", "aircraftCodes": ["B738"], "name": "시험용", "order": 1,
          "officialSeats": [31], "registrations": [], "source": "https://example.com", "checkedOn": "2026-11-10",
          "cabins": [
            { "class": "business", "fromRow": 1, "toRow": 1, "seats": "AC DF" },
            { "class": "economy", "fromRow": 7, "toRow": 8, "seats": "ABC DEF" },
            { "class": "economy", "fromRow": 28, "toRow": 30, "seats": "ABC DEF", "missing": ["30D", "30E", "30F"] } ],
          "exitRows": [28], "extraLegroom": ["7", "1A"],
          "overWing": { "fromRow": 8, "toRow": 28 },
          "noWindow": ["8A", "29"], "noRecline": ["8", "30A"],
          "facilities": [
            { "type": "lavatory", "afterRow": 0, "side": "left" },
            { "type": "exit", "afterRow": 8, "side": "both" },
            { "type": "galley", "afterRow": 30, "side": "both" } ] }""";
    static final String WIDE = """
        { "id": "XX-A333-12", "airline": "XX", "aircraftCodes": ["A333"], "name": "시험용 통로 둘", "order": 1,
          "officialSeats": [12], "registrations": [], "source": "https://example.com", "checkedOn": "2026-11-10",
          "cabins": [
            { "class": "business", "fromRow": 1, "toRow": 1, "seats": "A DG K" },
            { "class": "economy", "fromRow": 2, "toRow": 2, "seats": "AB DEFG HJ" } ],
          "exitRows": [], "extraLegroom": [], "overWing": null, "noWindow": null, "noRecline": null, "facilities": [] }""";

    @Test void 좌석이_펼쳐진다() {
        SeatMap m = map(BASE);
        assertThat(m.seatCount()).isEqualTo(31);
        assertThat(m.seats()).extracting(SeatMap.Seat::seat)
                .startsWith("1A", "1C", "1D", "1F", "7A").endsWith("30A", "30B", "30C")
                .doesNotContain("1B", "30D", "9A").doesNotHaveDuplicates();
        assertThat(m.aircraft()).isEqualTo("B737-800");
        assertThat(m.cabins()).extracting(SeatMap.Cabin::cabinClass).containsExactly("business", "economy", "economy");
        assertThat(seat(m, "7A")).extracting("row", "column", "cabin").containsExactly(7, "A", "economy");
        assertThat(seat(m, "1A").cabin()).isEqualTo("business");
    }

    @Test void 글자_묶음으로_좌우와_창가_통로를_정한다() {
        SeatMap m = map(BASE);
        assertThat(List.of("7A", "7B", "7C", "7D", "7E", "7F", "1A", "1C", "1D", "1F"))
                .extracting(id -> seat(m, id).side() + "/" + seat(m, id).position())
                .containsExactly("left/window", "left/middle", "left/aisle", "right/aisle", "right/middle", "right/window",
                        "left/window", "left/aisle", "right/aisle", "right/window");
    }

    @Test void 통로가_둘이면_가운데_묶음은_center() {
        SeatMap m = map(WIDE);
        assertThat(List.of("1A", "1D", "1G", "1K", "2A", "2B", "2D", "2E", "2F", "2G", "2H", "2J"))
                .extracting(id -> seat(m, id).side() + "/" + seat(m, id).position())
                .containsExactly("left/window", "center/aisle", "center/aisle", "right/window",
                        "left/window", "left/aisle", "center/aisle", "center/middle", "center/middle", "center/aisle",
                        "right/aisle", "right/window");
    }

    @Test void 열_번호가_건너뛰어도_위치_순서로_구역을_나눈다() {
        assertThat(map(BASE).seats()).filteredOn(s -> s.column().equals("A")).extracting(s -> s.row() + s.zone())
                .containsExactly("1front", "7front", "8middle", "28middle", "29rear", "30rear");
    }

    @Test void 화장실과_갤리에서_두_열_이내만_가깝다() {
        assertThat(map(BASE).seats()).filteredOn(s -> s.column().equals("A")).extracting(s -> s.row() + ":" + s.nearLavatory())
                .containsExactly("1:true", "7:true", "8:false", "28:false", "29:true", "30:true");
        SeatMap mid = map(with("facilities", """
                [{ "type": "lavatory", "afterRow": 8, "side": "left" }]"""));
        assertThat(mid.seats()).filteredOn(s -> s.column().equals("A")).extracting(s -> s.row() + ":" + s.nearLavatory())
                .containsExactly("1:false", "7:true", "8:true", "28:true", "29:true", "30:false");
    }

    @Test void 빠진_좌석이_있어도_옆_좌석의_자리는_그대로다() {
        String json = with(WIDE, "cabins", """
                [{ "class": "economy", "fromRow": 7, "toRow": 8, "seats": "ABC DEF", "missing": ["7A", "7C", "7F"] }]""");
        SeatMap m = SeatMap.from(JSON.readValue(json, SeatMapFile.class));
        assertThat(List.of("7B", "7D", "7E"))
                .extracting(id -> seat(m, id).side() + "/" + seat(m, id).position() + "/" + seat(m, id).hasWindow())
                .containsExactly("left/middle/false", "right/aisle/false", "right/middle/false");
        assertThat(m.seats()).extracting(SeatMap.Seat::seat).doesNotContain("7A", "7C", "7F");
        assertThatIllegalArgumentException().isThrownBy(() -> map(with(json, "noWindow", "[\"7B\"]")))
                .withMessageContaining("XX-");
    }

    @Test void 공개한_특징은_참_거짓으로_나간다() {
        SeatMap m = map(BASE);
        assertThat(List.of("8A", "8F", "29A", "29F", "7A", "7B")).extracting(id -> seat(m, id).hasWindow())
                .containsExactly(false, true, false, false, true, false);
        assertThat(List.of("8A", "28F", "7A", "29A")).extracting(id -> seat(m, id).overWing())
                .containsExactly(true, true, false, false);
        assertThat(List.of("8C", "30A", "30B", "7A")).extracting(id -> seat(m, id).noRecline())
                .containsExactly(true, true, false, false);
        assertThat(List.of("28A", "8A")).extracting(id -> seat(m, id).exitRow()).containsExactly(true, false);
        assertThat(List.of("7C", "1A", "1C", "28D", "8A")).extracting(id -> seat(m, id).extraLegroom())
                .containsExactly(true, true, false, false, false);
    }

    @Test void 다리_공간_목록이_있으면_비상구열이어도_목록에_없는_좌석은_넓지_않다() {
        SeatMap m = map(with("extraLegroom", "[\"28A\"]"));
        assertThat(List.of("28A", "28B", "28D")).extracting(id -> seat(m, id).extraLegroom())
                .containsExactly(true, false, false);
        assertThat(List.of("28A", "28B", "28D")).extracting(id -> seat(m, id).exitRow()).containsOnly(true);
    }

    @Test void 다리_공간이_모름이면_비상구_좌석을_넓다고_본다() {
        SeatMap m = map(with("extraLegroom", "null"));
        assertThat(List.of("28A", "28F", "7C", "1A")).extracting(id -> seat(m, id).extraLegroom())
                .containsExactly(true, true, false, false);
    }

    @Test void 비상구를_좌석_하나로_적으면_그_좌석만_비상구다() {
        SeatMap one = map(with("exitRows", "[\"28A\"]"));
        assertThat(List.of("28A", "28B", "28D")).extracting(id -> seat(one, id).exitRow())
                .containsExactly(true, false, false);
        // JSON 숫자와 문자열이 섞여도 읽힌다 (기존 파일은 숫자로 적혀 있다)
        SeatMap mixed = map(with("exitRows", "[28, \"8A\"]"));
        assertThat(List.of("28F", "8A", "8B")).extracting(id -> seat(mixed, id).exitRow())
                .containsExactly(true, true, false);
    }

    @Test void 공개하지_않은_특징은_모름이다() {
        assertThat(seat(map(with("noWindow", "null")), "7A").hasWindow()).isNull();
        assertThat(seat(map(with("noWindow", "null")), "7B").hasWindow()).isFalse(); // 창가가 아니면 늘 false
        assertThat(map(with("overWing", "null")).seats()).extracting(SeatMap.Seat::overWing).containsOnlyNulls();
        assertThat(map(with("noRecline", "null")).seats()).extracting(SeatMap.Seat::noRecline).containsOnlyNulls();
    }

    @Test void 공개했고_해당_좌석이_없으면_거짓이다() {
        assertThat(seat(map(with("noWindow", "[]")), "8A").hasWindow()).isTrue();
        assertThat(seat(map(with("noRecline", "[]")), "8C").noRecline()).isFalse();
    }

    @ParameterizedTest @MethodSource("badFiles")
    void 틀린_파일은_읽을_때_멈춘다(String json) {
        assertThatIllegalArgumentException().isThrownBy(() -> map(json)).withMessageContaining("XX-");
    }
    static Stream<String> badFiles() {
        return Stream.of(
                with("noWindow", "[\"31A\"]"),                       // 없는 좌석
                with("noWindow", "[\"7B\"]"),                        // 창가가 아닌 좌석
                with("noRecline", "[\"99\"]"),                       // 없는 열
                with("extraLegroom", "[\"1B\"]"),
                with("exitRows", "[9]"),
                with("exitRows", "[\"9A\"]"),                      // 없는 좌석
                with("overWing", "{\"fromRow\":40,\"toRow\":45}"),
                with("facilities", "[{\"type\":\"lavatory\",\"afterRow\":5,\"side\":\"left\"}]"),
                with("facilities", "[{\"type\":\"toilet\",\"afterRow\":0,\"side\":\"left\"}]"),
                with("facilities", "[{\"type\":\"exit\",\"afterRow\":8,\"side\":\"middle\"}]"),
                with("aircraftCodes", "[]"),
                // 객실이 틀린 경우는 다른 칸이 비어 있는 WIDE에서 바꾼다 (틀린 이유가 하나뿐이도록)
                with(WIDE, "cabins", "[{\"class\":\"economy\",\"fromRow\":7,\"toRow\":8,\"seats\":\"ABC DEF\"},{\"class\":\"economy\",\"fromRow\":8,\"toRow\":9,\"seats\":\"ABC DEF\"}]"),
                with(WIDE, "cabins", "[{\"class\":\"economy\",\"fromRow\":7,\"toRow\":8,\"seats\":\"ABC DEF\",\"missing\":[\"9A\"]}]"),
                with(WIDE, "cabins", "[{\"class\":\"economy\",\"fromRow\":8,\"toRow\":7,\"seats\":\"ABC DEF\"}]"),
                with(WIDE, "cabins", "[{\"class\":\"economy\",\"fromRow\":7,\"toRow\":8,\"seats\":\"ABA DEF\"}]"),
                with(WIDE, "cabins", "[{\"class\":\"cheap\",\"fromRow\":7,\"toRow\":8,\"seats\":\"ABC DEF\"}]"),
                with(WIDE, "cabins", "[]"));
    }

    @Test void 기종_코드의_화면_이름() {
        assertThat(Stream.of("B738", "B38M", "B739", "BCS3", "A21N", "A333", "A321", "A320", "B772", "B789").map(AircraftNames::of))
                .containsExactly("B737-800", "B737-8", "B737-900", "A220-300", "A321neo", "A330-300", "A321", "A320", "B777-200", "B789");
    }
}

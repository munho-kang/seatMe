package com.example.seatMe.recommend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.example.seatMe.recommend.SeatScorer.Preferences;
import com.example.seatMe.recommend.SeatScorer.Scored;
import com.example.seatMe.seatmap.SeatMap;
import com.example.seatMe.seatmap.SeatMapFile;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * 좌석 점수 규칙 확인. 시험용 비행기 두 대로 본다.
 * PLANE: 비즈니스 1~2열 + 일반석 7~36열(통로 하나). 줄 순서로는 7열이 3번째, 20열(날개 가운데)이 16번째, 36열이 32번째(마지막).
 * UNKNOWN: 항공사가 날개 · 창문 · 화장실 위치를 알려 주지 않은 통로 둘짜리.
 */
class SeatScorerTest {

    static final String PLANE = """
        { "id": "XX-B738-186", "airline": "XX", "aircraftCodes": ["B738"], "name": "시험용", "order": 1,
          "officialSeats": null, "registrations": [], "source": "https://example.com", "checkedOn": "2026-11-11",
          "cabins": [
            { "class": "business", "fromRow": 1, "toRow": 2, "seats": "AC DF" },
            { "class": "economy", "fromRow": 7, "toRow": 36, "seats": "ABC DEF" } ],
          "exitRows": ["20"], "extraLegroom": null,
          "overWing": { "fromRow": 17, "toRow": 23 },
          "noWindow": ["15A"], "noRecline": null,
          "facilities": [
            { "type": "lavatory", "afterRow": 0, "side": "left" },
            { "type": "lavatory", "afterRow": 36, "side": "both" } ] }""";
    static final String UNKNOWN = """
        { "id": "XX-A333-40", "airline": "XX", "aircraftCodes": ["A333"], "name": "시험용 모름", "order": 1,
          "officialSeats": null, "registrations": [], "source": "https://example.com", "checkedOn": "2026-11-11",
          "cabins": [ { "class": "economy", "fromRow": 1, "toRow": 5, "seats": "AB CDEF GH" } ],
          "exitRows": [], "extraLegroom": null, "overWing": null, "noWindow": null, "noRecline": null, "facilities": [] }""";

    static final Sun NO_SUN = new Sun(0, 0);
    static final Preferences DONT_CARE = new Preferences(1, 1, 1, 1, 1, "any");

    @Test void 햇빛이_중요하면_해가_드는_쪽_창가를_피한다() {
        Preferences sunlight = new Preferences(5, 1, 1, 1, 1, "any");
        SeatMap plane = plane(PLANE);

        List<Scored> right = top3(plane, new Sun(0, 0.6), sunlight);
        assertThat(right).noneMatch(s -> seat(plane, s.seat()).side().equals("right"));

        List<Scored> left = top3(plane, new Sun(0.6, 0), sunlight);
        assertThat(seat(plane, left.get(0).seat()).side()).isNotEqualTo(seat(plane, right.get(0).seat()).side());
    }

    @Test void 전부_신경_안_쓰면_모든_좌석이_100점이고_순서는_늘_같다() {
        List<Scored> first = SeatScorer.rank(plane(PLANE), new Sun(0.3, 0), DONT_CARE);

        assertThat(first).allMatch(s -> s.score() == 100 && s.features().isEmpty() && s.tradeoff() == null);
        // 동점이면 앞 열 먼저, 같은 열이면 글자 순
        assertThat(first.subList(0, 3)).extracting(Scored::seat).containsExactly("7A", "7B", "7C");
        assertThat(first.subList(0, 3)).extracting(Scored::rank).containsExactly(1, 2, 3);
        assertThat(SeatScorer.rank(plane(PLANE), new Sun(0.3, 0), DONT_CARE)).isEqualTo(first);
    }

    @Test void 일반석만_추천한다() {
        SeatMap plane = plane(PLANE);
        List<Scored> all = SeatScorer.rank(plane, NO_SUN, new Preferences(1, 1, 1, 1, 5, "any"));

        assertThat(all).hasSize(180).allMatch(s -> seat(plane, s.seat()).cabin().equals("economy"));
    }

    @Test void 빠른_하차는_열_번호가_아니라_앞에서_몇_번째_줄인지로_잰다() {
        List<Scored> all = SeatScorer.rank(plane(PLANE), NO_SUN, new Preferences(1, 1, 1, 1, 5, "any"));

        // 7열은 비즈니스 두 줄 뒤 3번째 줄: 1 − 2/31. 열 번호로 재면 1 − 6/35 = 0.83이 된다
        assertThat(score(all, "7A", "quickExit")).isCloseTo(0.94, within(0.005));
        assertThat(score(all, "36A", "quickExit")).isZero();
        assertThat(all.get(0).score()).isEqualTo(94);
    }

    @Test void 햇빛_점수는_해가_드는_쪽_창가에서_가장_낮다() {
        List<Scored> all = SeatScorer.rank(plane(PLANE), new Sun(0, 0.5), DONT_CARE);

        assertThat(score(all, "7F", "sunlight")).isCloseTo(0.5, within(0.005)); // 창가 1.0
        assertThat(score(all, "7E", "sunlight")).isCloseTo(0.7, within(0.005)); // 가운데 0.6
        assertThat(score(all, "7D", "sunlight")).isCloseTo(0.85, within(0.005)); // 통로 0.3
        assertThat(score(all, "7A", "sunlight")).isEqualTo(1.0); // 반대쪽
    }

    @Test void 전망_점수는_창문과_날개를_본다() {
        List<Scored> all = SeatScorer.rank(plane(PLANE), NO_SUN, DONT_CARE);

        assertThat(score(all, "7A", "view")).isEqualTo(1.0); // 창문 있는 창가, 날개 밖
        assertThat(score(all, "17A", "view")).isEqualTo(0.6); // 날개 위
        assertThat(score(all, "15A", "view")).isEqualTo(0.2); // 창문 없는 창가
        assertThat(score(all, "7B", "view")).isEqualTo(0.2); // 가운데
        assertThat(score(all, "7C", "view")).isEqualTo(0.0); // 통로
    }

    @Test void 조용함_점수는_구역에서_화장실_근처와_비상구_좌석을_깎는다() {
        List<Scored> all = SeatScorer.rank(plane(PLANE), NO_SUN, DONT_CARE);

        assertThat(score(all, "7A", "quietness")).isEqualTo(1.0); // 앞 구역
        assertThat(score(all, "19A", "quietness")).isEqualTo(0.7); // 가운데 구역
        assertThat(score(all, "20A", "quietness")).isCloseTo(0.6, within(0.005)); // 가운데 구역 비상구 좌석
        assertThat(score(all, "30A", "quietness")).isEqualTo(0.4); // 뒤 구역
        assertThat(score(all, "36A", "quietness")).isCloseTo(0.1, within(0.005)); // 뒤 구역 화장실 근처
    }

    @Test void 흔들림_점수는_날개_가운데_줄에서_가장_높다() {
        List<Scored> all = SeatScorer.rank(plane(PLANE), NO_SUN, DONT_CARE);

        assertThat(score(all, "20A", "turbulence")).isEqualTo(1.0); // 날개 17~23열의 가운데
        assertThat(score(all, "36A", "turbulence")).isZero(); // 가장 먼 줄
        assertThat(score(all, "7A", "turbulence")).isCloseTo(0.19, within(0.005)); // 13줄 ÷ 16줄 떨어짐
    }

    @Test void 자리_위치는_원하는_쪽이_1점이고_항상이면_더_무겁다() {
        List<Scored> window = SeatScorer.rank(plane(PLANE), NO_SUN, new Preferences(1, 1, 1, 1, 1, "always-window"));
        assertThat(score(window, "7A", "position")).isEqualTo(1.0);
        assertThat(score(window, "7B", "position")).isEqualTo(0.3);
        assertThat(score(window, "7C", "position")).isEqualTo(0.0);
        assertThat(window.subList(0, 3)).extracting(Scored::seat).containsExactly("7A", "7F", "8A");

        // 빠른 하차 2(가중치 1)와 함께면: 통로 선호(2)보다 항상 통로(4)일 때 가운데 좌석 점수가 더 깎인다
        List<Scored> prefer = SeatScorer.rank(plane(PLANE), NO_SUN, new Preferences(1, 1, 1, 1, 2, "prefer-aisle"));
        List<Scored> always = SeatScorer.rank(plane(PLANE), NO_SUN, new Preferences(1, 1, 1, 1, 2, "always-aisle"));
        assertThat(prefer.get(0).seat()).isEqualTo("7C");
        assertThat(total(always, "7B")).isLessThan(total(prefer, "7B"));
    }

    @Test void 잘_맞는_항목과_아쉬운_항목을_가중치_순으로_고른다() {
        Preferences profile = new Preferences(5, 3, 4, 4, 2, "prefer-window");
        Scored seat = SeatScorer.rank(plane(PLANE), new Sun(0, 0.55), profile).stream()
                .filter(s -> s.seat().equals("7A")).findFirst().orElseThrow();

        // 가중치 × 점수: 햇빛 4.0 · 조용함 3.0 · 전망 2.0 · 자리 2.0 · 빠른 하차 0.94 (5번째라 빠짐) · 흔들림은 0.7 미만
        assertThat(seat.features()).containsExactly("sunlight", "quietness", "view", "position");
        assertThat(seat.tradeoff()).isEqualTo("turbulence");
        assertThat(seat.score()).isEqualTo(83); // (4 + 2 + 3 + 3×0.19 + 0.94 + 2) ÷ 15
    }

    @Test void 잘_맞는_항목이_동시에_아쉬운_항목이_되지는_않는다() {
        Preferences profile = new Preferences(5, 3, 4, 4, 2, "prefer-window");
        List<Scored> all = SeatScorer.rank(plane(PLANE), new Sun(0, 0.55), profile);

        // 16A에서 가장 많이 깎인 항목은 조용함(가중치 3 × 0.3)이지만 0.7은 "잘 맞는" 점수다.
        // 그래서 아쉬운 항목은 0.7이 안 되는 것 중에서 고른다 — 빠른 하차 0.65
        Scored seat = all.stream().filter(s -> s.seat().equals("16A")).findFirst().orElseThrow();
        assertThat(seat.features()).contains("quietness");
        assertThat(seat.tradeoff()).isEqualTo("quickExit");
        assertThat(all).allMatch(s -> s.tradeoff() == null || s.scores().get(s.tradeoff()) < SeatScorer.FEATURE_MIN);
    }

    @Test void 모르는_정보는_가운데_점수를_주고_날개를_모르면_흔들림을_뺀다() {
        List<Scored> all = SeatScorer.rank(plane(UNKNOWN), NO_SUN, new Preferences(1, 1, 1, 5, 1, "any"));

        assertThat(score(all, "1A", "view")).isEqualTo(0.5); // 창문도 날개도 모르는 창가
        assertThat(score(all, "1A", "quietness")).isCloseTo(0.85, within(0.005)); // 화장실 위치를 몰라 반만 깎음
        assertThat(score(all, "1A", "turbulence")).isNull();
        // 흔들림만 중요한데 계산할 수 없으니 가중치가 없는 것과 같다
        assertThat(all).allMatch(s -> s.score() == 100 && s.tradeoff() == null);
    }

    @Test void 모르는_정보로_매긴_항목은_잘_맞는_점에도_아쉬운_점에도_넣지_않는다() {
        // 창문 · 날개를 모르는 창가 1A의 전망 0.5는 "나쁘다"가 아니라 "모른다"이다
        List<Scored> view = SeatScorer.rank(plane(UNKNOWN), NO_SUN, new Preferences(1, 5, 1, 1, 1, "always-window"));
        assertThat(find(view, "1A").features()).containsExactly("position");
        assertThat(find(view, "1A").tradeoff()).isNull();
        assertThat(find(view, "1D").tradeoff()).isEqualTo("view"); // 가운데 좌석에 전망이 없는 것은 아는 사실이다

        // 화장실 위치를 모르는 배치의 조용함도 마찬가지
        List<Scored> quiet = SeatScorer.rank(plane(UNKNOWN), NO_SUN, new Preferences(1, 1, 5, 1, 1, "any"));
        assertThat(find(quiet, "1A").features()).isEmpty();
    }

    @Test void 총점은_반올림_오차_없이_계산한다() {
        // 89.5가 계산 오차로 89.4999…가 되어 89점으로 내려가면 안 된다. 정수로만 다시 계산한 값과 비교한다
        SeatMap plane = plane(PLANE);
        int[] levels = {1, 2, 3, 4, 5};
        for (int a : levels) for (int b : levels) for (int c : levels) for (int d : levels) {
            Preferences p = new Preferences(a, b, c, d, 2, "prefer-window");
            int[] weights = {a - 1, b - 1, c - 1, d - 1, 1, 2};
            int weightSum = a + b + c + d - 1;
            for (Scored s : SeatScorer.rank(plane, new Sun(0, 0.55), p)) {
                long sum = 0;
                int i = 0;
                for (Double score : s.scores().values()) sum += weights[i++] * Math.round(score * 100);
                assertThat(s.score()).as(s.seat() + " " + p).isEqualTo((int) ((2 * sum + weightSum) / (2 * weightSum)));
            }
        }
    }

    @Test void 가운데_묶음_좌석은_햇빛이_들지_않는다고_본다() {
        List<Scored> all = SeatScorer.rank(plane(UNKNOWN), new Sun(0.4, 0.4), DONT_CARE);

        assertThat(score(all, "1D", "sunlight")).isEqualTo(1.0);
        assertThat(score(all, "1A", "sunlight")).isCloseTo(0.6, within(0.005));
    }

    private static List<Scored> top3(SeatMap plane, Sun sun, Preferences preferences) {
        return SeatScorer.rank(plane, sun, preferences).subList(0, 3);
    }

    private static Double score(List<Scored> all, String seat, String item) {
        return all.stream().filter(s -> s.seat().equals(seat)).findFirst().orElseThrow().scores().get(item);
    }

    private static Scored find(List<Scored> all, String seat) {
        return all.stream().filter(s -> s.seat().equals(seat)).findFirst().orElseThrow();
    }

    private static int total(List<Scored> all, String seat) {
        return all.stream().filter(s -> s.seat().equals(seat)).findFirst().orElseThrow().score();
    }

    private static SeatMap plane(String json) {
        return SeatMap.from(JsonMapper.builder().build().readValue(json, SeatMapFile.class));
    }

    private static SeatMap.Seat seat(SeatMap plane, String id) {
        return plane.seats().stream().filter(s -> s.seat().equals(id)).findFirst().orElseThrow();
    }
}

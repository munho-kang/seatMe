package com.example.seatMe.recommend;

import com.example.seatMe.seatmap.SeatMap;
import com.example.seatMe.seatmap.SeatMap.Seat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.IntSummaryStatistics;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 좌석 점수 (Seat Fit Score) = (항목 점수 × 가중치)의 합 ÷ 가중치 합 × 100, 반올림한 정수.
 * 항목은 sunlight · view · quietness · turbulence · quickExit · position 여섯 개이고 항목 점수는 0~1이다.
 * 한 사람 기준이고 일반석만 추천한다. 등받이가 고정된 좌석은 뺀다. 조정할 숫자는 아래 상수에 모아 두었다.
 *
 * 항공사가 알려 주지 않은 정보(null)는 "아니다"로 치지 않는다:
 * 창문 · 날개 위 · 화장실 근처를 모르면 "그렇다"와 "아니다" 점수의 가운데를 주고,
 * 날개 위치를 아예 모르는 배치는 날개가 흔히 있는 자리(WING_GUESS)로 어림해 흔들림을 매긴다.
 * 이런 점수는 "나쁘다"가 아니라 "모른다"라서, 그렇게 매긴 항목은 잘 맞는 점 · 아쉬운 점으로 내세우지 않는다.
 */
final class SeatScorer {

    /** 취향 1~5 (1은 "전혀 신경 안 씀")와 창가 · 통로 선호. */
    record Preferences(int sunlight, int view, int quietness, int turbulence, int quickExit, String seatPosition) {}

    /**
     * 좌석 하나의 결과.
     * features: 잘 맞는 항목 — 점수 0.7 이상인 것을 가중치 × 점수가 큰 순서로 최대 4개.
     * tradeoff: 가장 아쉬운 항목 — 점수 0.7 미만인 것 중 가중치 × (1 − 점수)가 가장 큰 하나, 없으면 null.
     * 가중치가 0인 항목(신경 안 쓰는 것)과 모르는 정보로 매긴 항목은 어느 쪽에도 나오지 않는다.
     * unsure: 모르는 정보로 매긴 항목. 점수는 어림값이라 화면이 "보통" 같은 등급 대신 "모름"으로 보여 준다.
     */
    record Scored(int rank, String seat, int score, Map<String, Double> scores, List<String> features, String tradeoff,
            List<String> unsure) {}

    // ── 조정할 숫자 ──
    /** 창가 · 통로 선호의 가중치. 나머지 항목의 가중치는 취향 − 1 (0~4). */
    static final Map<String, Integer> POSITION_WEIGHT = Map.of(
            "always-aisle", 4, "prefer-aisle", 2, "any", 0, "prefer-window", 2, "always-window", 4);
    /** 햇빛이 좌석까지 닿는 정도. 가운데 묶음(side center)은 창에서 멀어 닿지 않는다고 본다. */
    static final Map<String, Double> SUN_REACH = Map.of("window", 1.0, "middle", 0.6, "aisle", 0.3);
    static final double VIEW_CLEAR = 1.0; // 창문 있는 창가, 날개 밖
    static final double VIEW_OVER_WING = 0.6; // 창문 있는 창가, 날개 위
    static final double VIEW_NO_WINDOW = 0.2; // 창문 없는 창가 · 가운데 좌석
    static final double VIEW_AISLE = 0;
    static final Map<String, Double> QUIET_ZONE = Map.of("front", 1.0, "middle", 0.7, "rear", 0.4);
    static final double QUIET_NEAR_LAVATORY = 0.3; // 화장실 · 갤리 근처면 깎는 점수
    static final double QUIET_EXIT_SEAT = 0.1; // 비상구 좌석이면 깎는 점수 (좌석 하나 단위)
    static final double POSITION_MIDDLE = 0.3; // 창가 · 통로를 원하는데 가운데 좌석일 때
    static final double UNKNOWN = 0.5; // 모름(null)은 "그렇다"일 가능성을 반으로 본다
    // 날개 위치를 모르는 배치는 날개 가운데가 앞에서 이만큼(줄 수의 비율)에 있다고 어림한다.
    // 날개를 아는 통로 하나짜리 배치 26개가 0.41~0.49다 (모르는 배치 6개도 모두 통로 하나짜리).
    // ponytail: 평균 하나로 어림한다 (두세 줄 어긋날 수 있다). 더 정확해야 하면 같은 기종 다른 항공사 배치의 날개 열을 쓴다
    static final double WING_GUESS = 0.45;
    static final double FEATURE_MIN = 0.7; // 이 점수부터 "잘 맞는 항목"
    static final int FEATURE_MAX = 4;

    private SeatScorer() {}

    /** 일반석(등받이 고정 좌석 제외)을 점수 높은 순 → 앞 열 순 → 좌석 글자 순으로. 언제 불러도 같은 순서다. */
    static List<Scored> rank(SeatMap map, Sun sun, Preferences p) {
        // 열 번호는 건너뛴다(대한항공 일반석은 28열부터). 그래서 거리는 번호가 아니라 앞에서 몇 번째 줄인지로 잰다
        List<Integer> rows = map.seats().stream().map(Seat::row).distinct().sorted().toList();
        int last = rows.size() - 1;
        IntSummaryStatistics wing = map.seats().stream().filter(s -> Boolean.TRUE.equals(s.overWing()))
                .mapToInt(s -> rows.indexOf(s.row())).summaryStatistics();
        boolean wingKnown = wing.getCount() > 0;
        double wingCenter = wingKnown ? (wing.getMin() + wing.getMax()) / 2.0 : last * WING_GUESS;
        double farthest = Math.max(wingCenter, last - wingCenter);
        String wanted = p.seatPosition().endsWith("window") ? "window" : p.seatPosition().endsWith("aisle") ? "aisle" : null;

        Map<String, Integer> weights = new LinkedHashMap<>(); // 이 순서가 항목 순서다 (동점일 때 앞 항목 먼저)
        weights.put("sunlight", p.sunlight() - 1);
        weights.put("view", p.view() - 1);
        weights.put("quietness", p.quietness() - 1);
        weights.put("turbulence", p.turbulence() - 1);
        weights.put("quickExit", p.quickExit() - 1);
        weights.put("position", POSITION_WEIGHT.get(p.seatPosition()));
        int weightSum = weights.values().stream().mapToInt(Integer::intValue).sum();

        record Entry(Seat seat, Scored scored) {}
        List<Entry> entries = new ArrayList<>();
        for (Seat s : map.seats()) {
            // 등받이가 고정이라고 확인된 좌석은 추천하지 않는다. 모름(null)은 고정이라고 볼 수 없어 그대로 추천한다
            if (!s.cabin().equals("economy") || Boolean.TRUE.equals(s.noRecline())) continue;
            int row = rows.indexOf(s.row());
            double sunOnSide = s.side().equals("left") ? sun.left() : s.side().equals("right") ? sun.right() : 0;

            Map<String, Double> scores = new LinkedHashMap<>();
            scores.put("sunlight", round2(1 - sunOnSide * SUN_REACH.get(s.position())));
            scores.put("view", round2(view(s)));
            scores.put("quietness", round2(Math.max(0, QUIET_ZONE.get(s.zone())
                    - chance(s.nearLavatory()) * QUIET_NEAR_LAVATORY - (s.exitRow() ? QUIET_EXIT_SEAT : 0))));
            scores.put("turbulence", round2(farthest == 0 ? 1 : 1 - Math.abs(row - wingCenter) / farthest));
            scores.put("quickExit", round2(last == 0 ? 1 : 1 - (double) row / last));
            scores.put("position", wanted == null || s.position().equals(wanted) ? 1.0
                    : s.position().equals("middle") ? POSITION_MIDDLE : 0.0);

            // 모르는 정보로 매긴 항목: 총점에는 들어가지만 잘 맞는 점 · 아쉬운 점으로 내세우지 않는다
            List<String> unsure = new ArrayList<>();
            if (s.position().equals("window") && (s.hasWindow() == null || s.overWing() == null)) unsure.add("view");
            if (s.nearLavatory() == null) unsure.add("quietness");
            if (!wingKnown) unsure.add("turbulence");

            long sum = 0; // 가중치 × 점수(백분의 일 단위). 정수로 더해야 89.5가 89.4999…가 되어 내려가지 않는다
            String tradeoff = null;
            double worst = 0;
            List<String> features = new ArrayList<>();
            for (var item : weights.entrySet()) {
                if (item.getValue() == 0) continue;
                double score = scores.get(item.getKey());
                sum += item.getValue() * Math.round(score * 100);
                if (unsure.contains(item.getKey())) continue;
                if (score >= FEATURE_MIN) {
                    features.add(item.getKey());
                    continue; // 잘 맞는 항목은 아쉬운 항목이 될 수 없다 (같은 항목이 양쪽에 나오면 안 된다)
                }
                double loss = item.getValue() * (1 - score);
                if (loss > worst) {
                    worst = loss;
                    tradeoff = item.getKey();
                }
            }
            features.sort(Comparator.comparingDouble((String item) -> weights.get(item) * scores.get(item)).reversed());
            int total = weightSum == 0 ? 100 : (int) Math.round((double) sum / weightSum);
            entries.add(new Entry(s, new Scored(0, s.seat(), total, scores,
                    List.copyOf(features.subList(0, Math.min(FEATURE_MAX, features.size()))), tradeoff, List.copyOf(unsure))));
        }
        entries.sort(Comparator.comparingInt((Entry e) -> e.scored().score()).reversed()
                .thenComparingInt(e -> e.seat().row())
                .thenComparing(e -> e.seat().column()));

        List<Scored> ranked = new ArrayList<>();
        for (Entry e : entries) {
            Scored s = e.scored();
            ranked.add(new Scored(ranked.size() + 1, s.seat(), s.score(), s.scores(), s.features(), s.tradeoff(), s.unsure()));
        }
        return ranked;
    }

    private static double view(Seat s) {
        if (s.position().equals("aisle")) return VIEW_AISLE;
        if (s.position().equals("middle")) return VIEW_NO_WINDOW;
        double window = chance(s.hasWindow());
        double wing = chance(s.overWing());
        return window * (wing * VIEW_OVER_WING + (1 - wing) * VIEW_CLEAR) + (1 - window) * VIEW_NO_WINDOW;
    }

    /** true 1 · false 0 · 모름 0.5. */
    private static double chance(Boolean known) {
        return known == null ? UNKNOWN : known ? 1 : 0;
    }

    private static double round2(double value) {
        return Math.round(value * 100) / 100.0;
    }
}

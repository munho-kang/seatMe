package com.example.seatMe.recommend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/**
 * 햇빛 계산 확인. 기대값은 NOAA 태양 위치 공식으로 미리 계산해 그날 일출 · 일몰 시각으로 검산한 고정값이다
 * (https://gml.noaa.gov/grad/solcalc/ 과 대조).
 */
class SunTest {

    static final LocalDate DAY = LocalDate.of(2026, 11, 13);

    @Test void 태양_위치는_NOAA_값과_1도_안에서_같다() {
        double[] noon = Sun.position(kst("12:17"), 37.558, 126.791); // 김포
        assertThat(noon[0]).isCloseTo(34.5, within(1.0)); // 고도
        assertThat(noon[1]).isCloseTo(180.0, within(1.0)); // 방위
        double[] afternoon = Sun.position(kst("14:25"), 37.558, 126.791);
        assertThat(afternoon[0]).isCloseTo(26.8, within(1.0));
        assertThat(afternoon[1]).isCloseTo(214.4, within(1.0));
    }

    @Test void 비행_방위각은_출발에서_도착을_보는_방향이다() {
        assertThat(Sun.bearing(37.558, 126.791, 33.511, 126.493)).isCloseTo(183.5, within(0.5)); // 김포→제주
        assertThat(Sun.bearing(33.511, 126.493, 37.558, 126.791)).isCloseTo(3.3, within(0.5)); // 제주→김포
    }

    @Test void 오후에_남쪽으로_가면_해는_오른쪽이고_북쪽으로_가면_왼쪽이다() {
        assertSun(Sun.of("GMP", "CJU", DAY, time("14:10"), time("15:20")), 0, 0.55);
        assertSun(Sun.of("CJU", "GMP", DAY, time("14:10"), time("15:20")), 0.55, 0);
    }

    @Test void 오전에_남쪽으로_가면_해는_왼쪽이다() {
        assertSun(Sun.of("GMP", "CJU", DAY, time("09:00"), time("10:10")), 0.63, 0);
    }

    @Test void 해_질_무렵에는_낮인_지점만_센다() {
        assertSun(Sun.of("GMP", "CJU", DAY, time("17:00"), time("18:10")), 0, 0.30); // 첫 지점만 낮
    }

    @Test void 밤에는_양쪽_다_0이다() {
        assertSun(Sun.of("GMP", "CJU", DAY, time("20:00"), time("21:10")), 0, 0);
    }

    @Test void 자정을_넘겨_도착해도_밤이다() {
        assertSun(Sun.of("GMP", "CJU", DAY, time("23:30"), time("00:40")), 0, 0);
    }

    private static void assertSun(Sun sun, double left, double right) {
        assertThat(sun.left()).isCloseTo(left, within(0.05));
        assertThat(sun.right()).isCloseTo(right, within(0.05));
    }

    private static LocalTime time(String hhmm) {
        return LocalTime.parse(hhmm);
    }

    private static Instant kst(String hhmm) {
        return DAY.atTime(time(hhmm)).atZone(ZoneId.of("Asia/Seoul")).toInstant();
    }
}

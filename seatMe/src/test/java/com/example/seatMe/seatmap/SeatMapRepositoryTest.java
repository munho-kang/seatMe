package com.example.seatMe.seatmap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import com.example.seatMe.seatmap.SeatMapRepository.Candidates;
import java.util.List;
import org.junit.jupiter.api.Test;

class SeatMapRepositoryTest {

    /** 1열 "ABC DEF" 객실 하나에 나머지는 빈 목록 · null인 배치도 파일. */
    static SeatMapFile file(String id, String airline, List<String> codes, int order, String... registrations) {
        return new SeatMapFile(id, airline, codes, id, order, null, List.of(registrations), "https://example.com",
                "2026-11-10", List.of(new SeatMapFile.Cabin("economy", 1, 1, "ABC DEF", null)), List.of(), List.of(),
                null, null, null, List.of());
    }

    static final SeatMapRepository REPO = new SeatMapRepository(List.of(
            file("KE-A333-276", "KE", List.of("A333"), 3),
            file("KE-A333-272", "KE", List.of("A333"), 1),
            file("KE-A333-284", "KE", List.of("A333"), 2),
            file("TW-B738-189", "TW", List.of("B738"), 1),
            file("LJ-B738-189", "LJ", List.of("B738", "B38M"), 1),
            file("BX-A321-HL7729", "BX", List.of("A321"), 1, "HL7729"),
            file("BX-A321-HL8256", "BX", List.of("A321"), 2, "HL8256", "HL8257")));

    @Test void 후보는_대표가_맨_앞이고_여럿이면_확정이_아니다() {
        assertThat(REPO.candidatesFor("KE", "A333", null))
                .isEqualTo(new Candidates(List.of("KE-A333-272", "KE-A333-284", "KE-A333-276"), false));
    }
    @Test void 후보가_하나면_확정이다() {
        assertThat(REPO.candidatesFor("TW", "B738", "")).isEqualTo(new Candidates(List.of("TW-B738-189"), true));
    }
    @Test void 기종_코드를_여럿_적은_배치는_코드마다_후보다() {
        assertThat(REPO.candidatesFor("LJ", "B738", null).ids()).containsExactly("LJ-B738-189");
        assertThat(REPO.candidatesFor("LJ", "B38M", null).ids()).containsExactly("LJ-B738-189");
    }
    @Test void 등록번호가_맞으면_그_배치_하나로_확정한다() {
        assertThat(REPO.candidatesFor("BX", "A321", "HL8257")).isEqualTo(new Candidates(List.of("BX-A321-HL8256"), true));
        assertThat(REPO.candidatesFor("BX", "A321", " hl8257 ")).isEqualTo(new Candidates(List.of("BX-A321-HL8256"), true));
    }
    @Test void 등록번호가_빈칸이거나_모르는_번호면_후보_전부() {
        for (String reg : new String[] {null, "", "  ", "HL0000"}) {
            assertThat(REPO.candidatesFor("BX", "A321", reg))
                    .isEqualTo(new Candidates(List.of("BX-A321-HL7729", "BX-A321-HL8256"), false));
        }
    }
    @Test void 다른_항공사의_등록번호로는_확정하지_않는다() {
        assertThat(REPO.candidatesFor("KE", "A333", "HL7729").confirmed()).isFalse();
    }
    @Test void 모르면_빈_목록이다() {
        Candidates none = new Candidates(List.of(), false);
        assertThat(REPO.candidatesFor("7C", "B738", null)).isEqualTo(none); // 파일 없는 항공사
        assertThat(REPO.candidatesFor("TW", "A321", null)).isEqualTo(none); // 파일 없는 기종
        assertThat(REPO.candidatesFor("TW", null, null)).isEqualTo(none);
        assertThat(REPO.candidatesFor("TW", "", null)).isEqualTo(none);
        assertThat(REPO.candidatesFor(null, "B738", null)).isEqualTo(none);
        assertThat(REPO.candidatesFor("  ", "B738", null)).isEqualTo(none);
    }
    @Test void id로_찾는다() {
        assertThat(REPO.findById("TW-B738-189")).get().extracting(SeatMap::seatCount).isEqualTo(6);
        assertThat(REPO.findById("tw-b738-189")).isEmpty();
        assertThat(REPO.findById(null)).isEmpty();
        assertThat(REPO.all()).extracting(SeatMap::id).startsWith("BX-A321-HL7729", "BX-A321-HL8256", "KE-A333-272");
    }
    @Test void 겹치는_파일이_있으면_멈춘다() {
        assertThatIllegalStateException().isThrownBy(() -> new SeatMapRepository(List.of(
                file("TW-B738-189", "TW", List.of("B738"), 1), file("TW-B738-189", "TW", List.of("B738"), 2))));   // 같은 id
        assertThatIllegalStateException().isThrownBy(() -> new SeatMapRepository(List.of(
                file("KE-A333-272", "KE", List.of("A333"), 1), file("KE-A333-284", "KE", List.of("A333"), 1))));   // order 겹침
        assertThatIllegalStateException().isThrownBy(() -> new SeatMapRepository(List.of(
                file("BX-A321-HL7729", "BX", List.of("A321"), 1, "HL7729"), file("BX-A321-HL7730", "BX", List.of("A321"), 2, "HL7729")))); // 등록번호 겹침
    }
    @Test void 기종_코드_하나라도_order가_겹치면_멈춘다() {
        assertThatIllegalStateException().isThrownBy(() -> new SeatMapRepository(List.of(
                file("LJ-B738-189", "LJ", List.of("B738", "B38M"), 1), file("LJ-B38M-180", "LJ", List.of("B38M"), 1))));
    }
    @Test void 펼치기에_실패하면_파일_id를_담아_멈춘다() {
        SeatMapFile bad = file("XX-A320-1", "XX", List.of(), 1); // aircraftCodes가 비어 있다
        assertThatIllegalStateException().isThrownBy(() -> new SeatMapRepository(List.of(bad)))
                .withMessageContaining("XX-A320-1").withCauseInstanceOf(IllegalArgumentException.class);
    }
    @Test void 파일이_하나도_없어도_시작한다() {
        SeatMapRepository empty = new SeatMapRepository(List.of()); // 실제 seatmaps 폴더에는 이제 파일이 있다
        assertThat(empty.all()).isEmpty();
        assertThat(empty.candidatesFor("KE", "A333", null)).isEqualTo(new Candidates(List.of(), false));
    }
}

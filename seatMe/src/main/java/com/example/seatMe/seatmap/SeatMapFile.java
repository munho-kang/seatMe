package com.example.seatMe.seatmap;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * 배치도 파일(seatmaps/*.json) 한 개의 모양. 짧은 설명이며, SeatMap.from이 좌석 목록으로 펼친다.
 * 칸 16개는 전부 적는다. 좌석을 가리키는 표기(missing · extraLegroom · noWindow · noRecline · exitRows)는
 * 숫자만 있으면 그 열 전체("14"), 아니면 좌석 하나("11A")다.
 * officialSeats · overWing · noWindow · noRecline · extraLegroom은 null이 "모름"(항공사가 그 배치에서 공개 안 함),
 * 빈 목록 []은 "공개했고 해당 좌석 없음"이다.
 */
public record SeatMapFile(
        String id, // 파일 이름과 같다
        String airline, // 편명 앞 두 글자
        List<String> aircraftCodes, // 공항공사 기종 코드. 첫 번째가 화면 이름이 된다
        String name, // 공식 페이지의 기종 이름 + 구분
        int order, // 항공사 페이지에 나오는 순서. 같은 항공사 + 기종 안에서 겹치지 않고, 가장 작은 것이 대표
        List<Integer> officialSeats, // 공식 좌석 수 목록. null이면 모름
        List<String> registrations, // 이 배치로 확인된 등록번호. HL + 숫자 4개, 없으면 []
        String source, // 공식 페이지 주소
        String checkedOn, // 본 날짜 YYYY-MM-DD
        List<Cabin> cabins, // 객실 순서대로. 열 번호가 건너뛰거나 글자 배열이 바뀌면 나눈다
        List<String> exitRows, // 항공사가 비상구 좌석으로 표시한 열("43" 그 열 전체) 또는 좌석 하나("49D")
        // 목록이면 목록에 있는 좌석만 다리 공간이 넓다 (비상구 좌석도 항공사가 넓다고 한 것만 적는다).
        // null이면 그 배치에 다리 공간 표시가 없다는 뜻이고, 그때만 비상구 좌석을 넓다고 본다. 표시가 없는 배치에 []를 쓰면 안 된다.
        List<String> extraLegroom,
        RowRange overWing, // 날개 위 열 범위. null이면 모름
        List<String> noWindow, // 창문 없는 창가 좌석. 열 전체("29")는 그 열의 창가 좌석, 좌석 하나는 창가 좌석이어야 한다
        List<String> noRecline, // 등받이가 고정된 좌석
        // afterRow는 "이 열 바로 뒤"이고 0은 맨 앞. lavatory · galley가 하나도 없으면 nearLavatory는 모름(null)이다.
        List<Facility> facilities) {

    public record Cabin(
            @JsonProperty("class") String cabinClass, int fromRow, int toRow, String seats, List<String> missing) {} // seats는 빈칸이 통로("ABC DEF"), missing은 없는 좌석(생략하면 없음)

    public record RowRange(int fromRow, int toRow) {}

    public record Facility(String type, int afterRow, String side) {}
}

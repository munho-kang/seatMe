package com.example.seatMe.seatmap;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/** 배치도 파일(seatmaps/*.json) 한 개의 모양. 짧은 설명이며, SeatMap.from이 좌석 목록으로 펼친다. */
public record SeatMapFile(
        String id,
        String airline,
        List<String> aircraftCodes,
        String name,
        int order,
        List<Integer> officialSeats,
        List<String> registrations,
        String source,
        String checkedOn,
        List<Cabin> cabins,
        List<Integer> exitRows,
        List<String> extraLegroom,
        RowRange overWing,
        List<String> noWindow,
        List<String> noRecline,
        List<Facility> facilities) {

    public record Cabin(
            @JsonProperty("class") String cabinClass, int fromRow, int toRow, String seats, List<String> missing) {}

    public record RowRange(int fromRow, int toRow) {}

    public record Facility(String type, int afterRow, String side) {}
}

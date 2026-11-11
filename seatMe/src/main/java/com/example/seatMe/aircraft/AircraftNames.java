package com.example.seatMe.aircraft;

import java.util.Map;

/** 공항공사 기종 코드를 화면에 보이는 이름으로 바꾼다. 표에 없으면 코드 그대로. */
public final class AircraftNames {

    private static final Map<String, String> NAMES = Map.of(
            "B738", "B737-800",
            "B38M", "B737-8",
            "B739", "B737-900",
            "BCS3", "A220-300",
            "A21N", "A321neo",
            "A333", "A330-300",
            "A321", "A321",
            "A320", "A320",
            "B772", "B777-200");

    private AircraftNames() {}

    public static String of(String code) {
        return NAMES.getOrDefault(code, code);
    }
}

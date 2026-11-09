package com.example.seatMe.aircraft;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// 편명을 받으면 기종을 찾아주는 서비스 (팀원이 사용할 기능)
@Service
public class AircraftTypeService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter API_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    private static final DateTimeFormatter SHOW_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final int SEARCH_DAYS = 7; // API가 기종을 알려주는 범위: 오늘 ~ 7일 뒤 (2026-11-07 실제 확인, 8일 뒤부터 0건)

    private final AircraftTypeClient aircraftTypeClient;

    public AircraftTypeService(AircraftTypeClient aircraftTypeClient) {
        this.aircraftTypeClient = aircraftTypeClient;
    }

    /**
     * 팀원용: 편명 + 날짜 → 기종 코드
     * @return 기종 코드 (예: "A321"). 못 찾으면 null
     */
    public String findAircraftType(String flightNo, LocalDate date) {
        AircraftTypeResult result = find(flightNo, date);
        return result == null ? null : result.aircraftType();
    }

    /**
     * 편명으로 항공편과 기종을 찾아요.
     * @param flightNo 편명 (예: "RS6347", 소문자도 가능)
     * @param date     운항 날짜. null이면 오늘 ~ 7일 뒤 중 가장 가까운 출발편
     * @return 조회 결과. 못 찾으면 null
     */
    public AircraftTypeResult find(String flightNo, LocalDate date) {
        String fln = flightNo.trim().toUpperCase();

        LocalDate start = (date != null) ? date : LocalDate.now(KST);
        LocalDate end = (date != null) ? date : start.plusDays(SEARCH_DAYS);
        String from = start.format(DateTimeFormatter.BASIC_ISO_DATE) + "0000";
        String to = end.format(DateTimeFormatter.BASIC_ISO_DATE) + "2359";
        String now = LocalDateTime.now(KST).format(API_TIME);

        return aircraftTypeClient.search(fln, from, to).stream()
                // 1) 편명이 정확히 같고, 시각과 기종 정보가 있는 것만
                .filter(item -> fln.equalsIgnoreCase(item.airFln()))
                .filter(item -> item.std() != null)
                .filter(item -> item.icaoApmCd() != null && !item.icaoApmCd().isBlank())
                // 2) 날짜를 안 줬으면 아직 출발 전인 편만
                .filter(item -> date != null || item.std().compareTo(now) >= 0)
                // 3) 출발 기록(O) 먼저, 그다음 빠른 시각 순
                .min(Comparator.comparing((KacAircraftResponse.Item item) -> !"O".equals(item.io()))
                        .thenComparing(KacAircraftResponse.Item::std))
                .map(item -> new AircraftTypeResult(
                        item.airFln(),
                        toShowTime(item.std()),
                        "O".equals(item.io()) ? item.airport() : item.city(),
                        "O".equals(item.io()) ? item.city() : item.airport(),
                        item.icaoApmCd()))
                .orElse(null);
    }

    /**
     * 그날 그 노선의 출발 기록을 한꺼번에 가져와요.
     * @param from 출발 공항 (예: GMP)
     * @param to   도착 공항 (예: CJU)
     * @return 편명 → 그 편명의 출발 기록들 (하루 두 번 뜨는 편명은 기록이 둘). 공항공사가 답이 없으면 빈 Map
     */
    public Map<String, List<KacAircraftResponse.Item>> findByRoute(String from, String to, LocalDate date) {
        return aircraftTypeClient.searchAirportDay(from, date).stream()
                .filter(item -> "O".equals(item.io()) && from.equals(item.airport()) && to.equals(item.city()))
                .filter(item -> item.airFln() != null && item.icaoApmCd() != null && !item.icaoApmCd().isBlank())
                .filter(item -> item.std() != null && item.std().matches("\\d{12}"))
                .collect(Collectors.groupingBy(KacAircraftResponse.Item::airFln));
    }

    /**
     * 같은 편명의 기록 중 출발 시각이 가장 가까운 것의 기종 코드.
     * 두 기관의 시각은 1시간쯤 어긋날 수 있어서, 딱 맞는 시각 대신 가장 가까운 시각으로 짝지어요.
     * @param records       findByRoute가 준 그 편명의 기록들 (null이면 짝 없음)
     * @param departureTime 국토부 출발 시각 "14:10"
     * @return 기종 코드. 기록이 없으면 null
     */
    // ponytail: 기록이 하나뿐이면 시각 차이와 상관없이 그 기종을 써요. 엉뚱하게 붙는 일이 생기면 "2시간 이내만" 같은 한도를 추가.
    public static String nearestAircraftType(List<KacAircraftResponse.Item> records, String departureTime) {
        if (records == null) {
            return null;
        }
        LocalTime dep = LocalTime.parse(departureTime);
        return records.stream()
                .min(Comparator.comparing((KacAircraftResponse.Item item) ->
                        Duration.between(dep, LocalDateTime.parse(item.std(), API_TIME).toLocalTime()).abs()))
                .map(KacAircraftResponse.Item::icaoApmCd)
                .orElse(null);
    }

    // "202611110600" → "2026-11-11 06:00"
    private String toShowTime(String std) {
        try {
            return LocalDateTime.parse(std, API_TIME).format(SHOW_TIME);
        } catch (Exception e) {
            return std;
        }
    }
}

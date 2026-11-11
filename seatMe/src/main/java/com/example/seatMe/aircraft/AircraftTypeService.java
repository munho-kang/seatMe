package com.example.seatMe.aircraft;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// 노선 하루치 기종 기록을 모아 국토부 항공편과 짝짓는 서비스
@Service
public class AircraftTypeService {

    private static final DateTimeFormatter API_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    private final AircraftTypeClient aircraftTypeClient;

    public AircraftTypeService(AircraftTypeClient aircraftTypeClient) {
        this.aircraftTypeClient = aircraftTypeClient;
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
     * 같은 편명의 기록 중 출발 시각이 가장 가까운 것의 기록 자체.
     * 두 기관의 시각은 1시간쯤 어긋날 수 있어서, 딱 맞는 시각 대신 가장 가까운 시각으로 짝지어요.
     * @param records       findByRoute가 준 그 편명의 기록들 (null이면 짝 없음)
     * @param departureTime 국토부 출발 시각 "14:10"
     * @return 가장 가까운 기록. 기록이 없으면 null
     */
    // ponytail: 기록이 하나뿐이면 시각 차이와 상관없이 그 기록을 써요. 엉뚱하게 붙는 일이 생기면 "2시간 이내만" 같은 한도를 추가.
    public static KacAircraftResponse.Item nearestRecord(List<KacAircraftResponse.Item> records, String departureTime) {
        if (records == null) {
            return null;
        }
        LocalTime dep = LocalTime.parse(departureTime);
        return records.stream()
                .min(Comparator.comparing((KacAircraftResponse.Item item) ->
                        Duration.between(dep, LocalDateTime.parse(item.std(), API_TIME).toLocalTime()).abs()))
                .orElse(null);
    }
}

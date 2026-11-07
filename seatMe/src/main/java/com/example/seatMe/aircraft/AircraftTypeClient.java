package com.example.seatMe.aircraft;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

// 한국공항공사 기종 API를 실제로 호출하는 클래스
@Component
public class AircraftTypeClient {

    private final RestClient restClient = RestClient.create();
    private final String baseUrl;
    private final String serviceKey;

    // application.properties에 적어둔 값을 받아와요
    public AircraftTypeClient(
            @Value("${kac.api.base-url}") String baseUrl,
            @Value("${kac.api.service-key}") String serviceKey) {
        this.baseUrl = baseUrl;
        this.serviceKey = serviceKey;
    }

    /**
     * 편명과 시간 범위로 항공편을 조회해요.
     * @param flightNo 편명 (예: RS6347)
     * @param from     조회 시작 시간 yyyyMMddHHmm (예: 202611110000)
     * @param to       조회 끝 시간   yyyyMMddHHmm (예: 202611112359)
     * @return 찾은 항공편 목록. 없거나 오류가 나면 빈 목록
     */
    public List<KacAircraftResponse.Item> search(String flightNo, String from, String to) {
        try {
            KacAircraftResponse result = restClient.get()
                    .uri(baseUrl + "?serviceKey={key}&type=json&numOfRows=50&pageNo=1"
                                    + "&schFln={fln}&schStTime={from}&schEdTime={to}",
                            serviceKey, flightNo, from, to)
                    .retrieve()
                    .body(KacAircraftResponse.class);

            // 응답이 비어 있으면 빈 목록
            if (result == null || result.response() == null
                    || result.response().body() == null
                    || result.response().body().items() == null
                    || result.response().body().items().item() == null) {
                return List.of();
            }
            return result.response().body().items().item();

        } catch (Exception e) {
            // API 오류가 나도 서버 전체가 멈추지 않게, 빈 목록을 돌려줘요
            System.out.println("[기종 API 오류] " + e.getMessage());
            return List.of();
        }
    }
}
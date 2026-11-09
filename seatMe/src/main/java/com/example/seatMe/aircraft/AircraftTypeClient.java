package com.example.seatMe.aircraft;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

// 한국공항공사 기종 API를 실제로 호출하는 클래스
@Component
public class AircraftTypeClient {

    private static final Logger log = LoggerFactory.getLogger(AircraftTypeClient.class);
    private final RestClient restClient;
    private final String baseUrl;
    private final String serviceKey;

    // application.properties에 적어둔 값을 받아와요
    public AircraftTypeClient(
            @Value("${kac.api.base-url}") String baseUrl,
            @Value("${kac.api.service-key}") String serviceKey,
            @Value("${kac.api.timeout-ms}") long timeoutMs) {
        this.baseUrl = baseUrl;
        this.serviceKey = serviceKey;
        // 공항공사가 답을 안 해도 하염없이 기다리지 않도록 제한 시간을 둬요
        Duration timeout = Duration.ofMillis(timeoutMs);
        var requestFactory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(timeout).build());
        requestFactory.setReadTimeout(timeout);
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
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
            String error = errorOf(result);
            if (error != null) {
                log.warn("공항공사 기종 API 오류 응답 → 기종만 비운다: {}", error);
                return List.of();
            }
            return itemsOf(result);

        } catch (Exception e) {
            // API 오류가 나도 서버 전체가 멈추지 않게, 빈 목록을 돌려줘요
            log.warn("공항공사 기종 API 오류 → 기종만 비운다: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * 한 공항의 하루치 기록을 끝까지 받아요. 편명마다 따로 묻지 않고 한꺼번에 받으려고 만들었어요.
     * @param airport 공항 코드 (예: GMP)
     * @param date    날짜
     * @return 찾은 기록. 중간에 오류가 나면 거기까지 받은 것만
     */
    // ponytail: 쪽을 하나씩 차례로 받는다. 응답이 느리면 대기 시간이 쪽 수만큼 늘어나니, 조회가 느려지면 동시에 받거나 결과를 저장해 두도록 바꾼다.
    public List<KacAircraftResponse.Item> searchAirportDay(String airport, LocalDate date) {
        String day = date.format(DateTimeFormatter.BASIC_ISO_DATE);
        List<KacAircraftResponse.Item> all = new ArrayList<>();
        try {
            for (int page = 1; ; page++) {
                KacAircraftResponse result = restClient.get()
                        .uri(baseUrl + "?serviceKey={key}&type=json&numOfRows=100&pageNo={page}"
                                        + "&schAirCode={airport}&schStTime={from}&schEdTime={to}",
                                serviceKey, page, airport, day + "0000", day + "2359")
                        .retrieve()
                        .body(KacAircraftResponse.class);
                String error = errorOf(result);
                if (error != null) {
                    log.warn("공항공사 기종 API 오류 응답 → 기종만 비운다: {}", error);
                    return all;
                }

                List<KacAircraftResponse.Item> items = itemsOf(result);
                all.addAll(items);
                if (items.isEmpty() || all.size() >= result.response().body().totalCount()) {
                    return all;
                }
            }
        } catch (Exception e) {
            log.warn("공항공사 기종 API 오류 → 기종만 비운다: {}", e.getMessage());
            return all;
        }
    }

    /** 정상 답(resultCode "00")이면 null, 아니면 오류 이름과 코드. 주소·인증키는 넣지 않는다. */
    private static String errorOf(KacAircraftResponse result) {
        if (result == null) {
            return "빈 응답";
        }
        if (result.serviceError() != null && result.serviceError().cmmMsgHeader() != null) {
            var header = result.serviceError().cmmMsgHeader();
            return header.errMsg() + " (코드 " + header.returnReasonCode() + ")";
        }
        if (result.response() == null || result.response().header() == null) {
            return "모르는 응답 모양";
        }
        var header = result.response().header();
        return "00".equals(header.resultCode()) ? null : header.resultMsg() + " (코드 " + header.resultCode() + ")";
    }

    // 응답이 비어 있으면 빈 목록
    private static List<KacAircraftResponse.Item> itemsOf(KacAircraftResponse result) {
        if (result == null || result.response() == null
                || result.response().body() == null
                || result.response().body().items() == null
                || result.response().body().items().item() == null) {
            return List.of();
        }
        return result.response().body().items().item();
    }
}
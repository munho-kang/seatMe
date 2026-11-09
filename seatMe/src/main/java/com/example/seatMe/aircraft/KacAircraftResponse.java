package com.example.seatMe.aircraft;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

// 한국공항공사 기종 API 응답(JSON)을 그대로 담는 그릇
// JSON 구조: response → header / body → items → item[]
// 오류일 때는 HTTP 200이어도 OpenAPI_ServiceResponse → cmmMsgHeader 모양으로 온다 (2026-11-09 실제 확인)
public record KacAircraftResponse(
        Response response,
        @JsonProperty("OpenAPI_ServiceResponse") ServiceError serviceError) {

    public record ServiceError(CmmMsgHeader cmmMsgHeader) {}

    public record CmmMsgHeader(String errMsg, String returnReasonCode) {}

    public record Response(Header header, Body body) {}

    public record Header(String resultCode, String resultMsg) {}

    public record Body(int totalCount, Items items) {}

    public record Items(List<Item> item) {}

    // 항공편 한 건. 우리가 쓸 필드만 골라 담았어요.
    public record Item(
            String airFln,     // 편명 (예: RS6347)
            String std,        // 예정 시간 (예: 202611110600)
            String io,         // O = 출발, I = 도착
            String airport,    // 기준공항 (예: GMP)
            String city,       // 상대공항 (예: CJU)
            String icaoApmCd   // 기종 코드 (예: A321) ← 우리가 필요한 값
    ) {}
}
package com.example.seatMe.seatmap;

import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * 화면이 부르는 창구 — GET /api/seatmaps (요약 목록), GET /api/seatmaps/{id} (배치도 하나).
 * 없는 id는 어떤 글자든 404 {"error":"SEAT_MAP_NOT_FOUND"}.
 */
@RestController
public class SeatMapController {

    record Summary(String id, String airline, String aircraft, String name, int seatCount) {}

    private final SeatMapRepository repository;

    SeatMapController(SeatMapRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/api/seatmaps")
    Map<String, List<Summary>> list() {
        return Map.of("seatMaps", repository.all().stream()
                .map(m -> new Summary(m.id(), m.airline(), m.aircraft(), m.name(), m.seatCount()))
                .toList());
    }

    @GetMapping("/api/seatmaps/{id}")
    ResponseEntity<?> one(@PathVariable String id) {
        return repository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "SEAT_MAP_NOT_FOUND")));
    }
}

package com.example.seatMe.seatmap;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** seatmaps/*.json을 시작할 때 전부 읽어 펼쳐 두고, id로 찾거나 편에 맞는 후보를 고른다. 틀린 파일이 있으면 시작을 멈춘다. */
@Component
public class SeatMapRepository {

    /** 후보 id들(대표가 맨 앞)과, 그 편의 배치로 확정했는지. */
    public record Candidates(List<String> ids, boolean confirmed) {}

    /**
     * "항공사 + 빈칸 + 기종 코드" 중 항공사에 배치가 더 있는데 일부만 옮겨 적은 조합. 후보가 하나여도 확정하지 않는다.
     * 파라타 A320은 공식 페이지에 174 · 168 · 156석 세 배치가 있는데 "국내선"이라 적힌 174석만 옮겼다. 배치를 다 옮기면 이 줄에서 지운다.
     */
    static final Set<String> INCOMPLETE = Set.of("WE A320");

    private final List<SeatMapFile> files; // 항공사 → order → id 순
    private final Map<String, SeatMap> byId = new LinkedHashMap<>(); // 같은 순서

    @Autowired
    public SeatMapRepository(ObjectMapper json) {
        this(read(json));
    }

    /** 테스트용. 파일 이름이 없으니 "파일 이름 = id" 검사만 빠지고 나머지는 똑같이 거친다. */
    SeatMapRepository(List<SeatMapFile> input) {
        files = input.stream()
                .sorted(Comparator.comparing(SeatMapFile::airline, Comparator.nullsFirst(Comparator.naturalOrder()))
                        .thenComparingInt(SeatMapFile::order)
                        .thenComparing(SeatMapFile::id, Comparator.nullsFirst(Comparator.naturalOrder())))
                .toList();
        Set<String> orders = new HashSet<>(); // 항공사 + 기종 코드 + order
        Map<String, String> registrationOwner = new HashMap<>();
        for (SeatMapFile f : files) {
            SeatMap map;
            try {
                map = SeatMap.from(f);
            } catch (Exception e) {
                throw new IllegalStateException(f.id() + ": 배치도 파일을 펼치지 못했다 (" + e.getMessage() + ")", e);
            }
            if (byId.put(f.id(), map) != null) throw new IllegalStateException("id가 겹친다: " + f.id());
            for (String code : f.aircraftCodes())
                if (!orders.add(f.airline() + "/" + code + "/" + f.order()))
                    throw new IllegalStateException(
                            f.id() + ": 같은 항공사 + 기종 " + f.airline() + " " + code + "에 order " + f.order() + "가 겹친다");
            for (String reg : f.registrations() == null ? List.<String>of() : f.registrations()) {
                String other = registrationOwner.put(reg, f.id());
                if (other != null)
                    throw new IllegalStateException(f.id() + ": 등록번호 " + reg + "가 " + other + "에도 있다");
            }
        }
    }

    private static List<SeatMapFile> read(ObjectMapper json) {
        List<SeatMapFile> out = new ArrayList<>();
        try {
            for (Resource r : new PathMatchingResourcePatternResolver().getResources("classpath*:seatmaps/*.json")) {
                String name = r.getFilename();
                try (InputStream in = r.getInputStream()) {
                    SeatMapFile f = json.readValue(in, SeatMapFile.class);
                    if (!name.equals(f.id() + ".json"))
                        throw new IllegalStateException(name + ": 파일 이름과 id가 다르다 (" + f.id() + ")");
                    out.add(f);
                } catch (IllegalStateException e) {
                    throw e;
                } catch (Exception e) {
                    throw new IllegalStateException(name + ": 배치도 파일을 읽지 못했다 (" + e.getMessage() + ")", e);
                }
            }
        } catch (IOException e) {
            throw new IllegalStateException("seatmaps 폴더를 읽지 못했다", e);
        }
        return out;
    }

    public Optional<SeatMap> findById(String id) {
        return Optional.ofNullable(id == null ? null : byId.get(id));
    }

    /** 항공사 → order → id 순. */
    public List<SeatMap> all() {
        return List.copyOf(byId.values());
    }

    List<SeatMapFile> files() {
        return files;
    }

    public Candidates candidatesFor(String airline, String aircraftCode, String registration) {
        if (airline == null || airline.isBlank() || aircraftCode == null || aircraftCode.isBlank())
            return new Candidates(List.of(), false);
        List<SeatMapFile> match = files.stream()
                .filter(f -> airline.equals(f.airline()) && f.aircraftCodes().contains(aircraftCode))
                .toList();
        if (registration != null && !registration.isBlank()) {
            String reg = registration.trim().toUpperCase(Locale.ROOT);
            for (SeatMapFile f : match)
                if (f.registrations() != null && f.registrations().contains(reg))
                    return new Candidates(List.of(f.id()), true);
        }
        return new Candidates(match.stream().map(SeatMapFile::id).toList(), match.size() == 1 && !INCOMPLETE.contains(airline + " " + aircraftCode));
    }
}

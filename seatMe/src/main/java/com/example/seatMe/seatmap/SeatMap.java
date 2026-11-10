package com.example.seatMe.seatmap;

import com.example.seatMe.aircraft.AircraftNames;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 화면으로 나가는 배치도: 파일의 짧은 설명을 좌석 하나하나로 펼친 것. 값은 전부 글자다. */
public record SeatMap(
        String id,
        String airline,
        String aircraft,
        String name,
        int seatCount,
        String source,
        String checkedOn,
        List<Cabin> cabins,
        List<Seat> seats,
        List<SeatMapFile.Facility> facilities) {

    public record Cabin(@JsonProperty("class") String cabinClass, int fromRow, int toRow, String seats) {}

    public record Seat(
            String seat,
            int row,
            String column,
            String cabin,
            String side,
            String position,
            Boolean hasWindow,
            Boolean overWing,
            boolean exitRow,
            String zone,
            boolean nearLavatory,
            Boolean noRecline,
            boolean extraLegroom) {}

    private static final Set<String> CLASSES = Set.of("first", "business", "premium", "economy");
    private static final Set<String> FACILITY_TYPES = Set.of("lavatory", "galley", "exit");
    private static final Set<String> SIDES = Set.of("left", "right", "center", "both");
    private static final Pattern REF = Pattern.compile("(\\d+)([A-Z]?)");

    /** 열 하나: 열 번호, 어느 객실인지, 그 열의 글자 묶음. */
    private record Row(int number, SeatMapFile.Cabin cabin, List<String> letters) {}

    /** 틀린 파일이면 "<id>: …" 메시지의 IllegalArgumentException으로 멈춘다. */
    public static SeatMap from(SeatMapFile f) {
        String id = f.id();
        if (f.aircraftCodes() == null || f.aircraftCodes().isEmpty()) throw bad(id, "aircraftCodes가 비어 있다");
        if (f.cabins() == null || f.cabins().isEmpty()) throw bad(id, "cabins가 비어 있다");

        List<Row> rows = rows(f);
        int rowCount = rows.size();
        Set<Integer> rowNumbers = new HashSet<>();
        rows.forEach(r -> rowNumbers.add(r.number()));

        // 좌석 만들기 (위치와 구역까지). 특징은 뒤에서 채운다.
        List<String> ids = new ArrayList<>();
        List<Seat> seats = new ArrayList<>();
        List<boolean[]> near = new ArrayList<>(); // 열 위치별 화장실 근처 여부
        for (int i = 0; i < rowCount; i++) near.add(new boolean[1]);
        for (SeatMapFile.Facility fac : nz(f.facilities())) {
            if (!FACILITY_TYPES.contains(fac.type())) throw bad(id, "정해지지 않은 시설 type: " + fac.type());
            if (!SIDES.contains(fac.side())) throw bad(id, "정해지지 않은 시설 side: " + fac.side());
            if (fac.afterRow() != 0 && !rowNumbers.contains(fac.afterRow()))
                throw bad(id, "afterRow가 없는 열이다: " + fac.afterRow());
            if (fac.type().equals("exit")) continue;
            int p = 0; // 시설 앞에 있는 열의 수
            for (Row r : rows) if (r.number() <= fac.afterRow()) p++;
            for (int i = Math.max(0, p - 2); i <= Math.min(rowCount - 1, p + 1); i++) near.get(i)[0] = true;
        }
        for (int i = 0; i < rowCount; i++) {
            Row r = rows.get(i);
            String zone = new String[] {"front", "middle", "rear"}[i * 3 / rowCount];
            List<String> groups = r.letters();
            for (int g = 0; g < groups.size(); g++) {
                String group = groups.get(g);
                String side = g == 0 ? "left" : g == groups.size() - 1 ? "right" : "center";
                for (int c = 0; c < group.length(); c++) {
                    boolean window = (g == 0 && c == 0) || (g == groups.size() - 1 && c == group.length() - 1);
                    String position = window ? "window"
                            : (c == 0 || c == group.length() - 1) ? "aisle" : "middle";
                    String seatId = r.number() + group.substring(c, c + 1);
                    if (ids.contains(seatId)) throw bad(id, "좌석 번호가 겹친다: " + seatId);
                    ids.add(seatId);
                    seats.add(new Seat(seatId, r.number(), group.substring(c, c + 1), r.cabin().cabinClass(), side,
                            position, null, null, false, zone, near.get(i)[0], null, false));
                }
            }
        }

        // 특징 목록이 가리키는 좌석
        Set<String> noWindow = f.noWindow() == null ? null : windowless(id, f.noWindow(), seats);
        Set<String> noRecline = f.noRecline() == null ? null : refs(id, "noRecline", f.noRecline(), seats);
        Set<String> legroom = refs(id, "extraLegroom", nz(f.extraLegroom()), seats);
        Set<Integer> exitRows = new HashSet<>(nz(f.exitRows()));
        for (int r : exitRows) if (!rowNumbers.contains(r)) throw bad(id, "exitRows의 열이 없다: " + r);
        SeatMapFile.RowRange wing = f.overWing();
        if (wing != null && rows.stream().noneMatch(r -> r.number() >= wing.fromRow() && r.number() <= wing.toRow()))
            throw bad(id, "overWing 범위에 열이 하나도 없다");

        List<Seat> out = new ArrayList<>();
        for (Seat s : seats) {
            boolean exit = exitRows.contains(s.row());
            Boolean hasWindow = !s.position().equals("window") ? Boolean.FALSE
                    : noWindow == null ? null : !noWindow.contains(s.seat());
            Boolean overWing = wing == null ? null : s.row() >= wing.fromRow() && s.row() <= wing.toRow();
            Boolean recline = noRecline == null ? null : noRecline.contains(s.seat());
            out.add(new Seat(s.seat(), s.row(), s.column(), s.cabin(), s.side(), s.position(), hasWindow, overWing,
                    exit, s.zone(), s.nearLavatory(), recline, exit || legroom.contains(s.seat())));
        }

        List<Cabin> cabins = f.cabins().stream()
                .map(c -> new Cabin(c.cabinClass(), c.fromRow(), c.toRow(), c.seats())).toList();
        return new SeatMap(id, f.airline(), AircraftNames.of(f.aircraftCodes().get(0)), f.name(), out.size(),
                f.source(), f.checkedOn(), cabins, out, nz(f.facilities()));
    }

    /** 객실 순서대로 열 목록을 만든다 (통째로 없는 열은 뺀다). 객실 칸 검사도 여기서 한다. */
    private static List<Row> rows(SeatMapFile f) {
        String id = f.id();
        List<Row> rows = new ArrayList<>();
        for (SeatMapFile.Cabin c : f.cabins()) {
            if (!CLASSES.contains(c.cabinClass())) throw bad(id, "정해지지 않은 class: " + c.cabinClass());
            if (c.fromRow() > c.toRow()) throw bad(id, "fromRow가 toRow보다 크다: " + c.fromRow() + ">" + c.toRow());
            String[] groups = c.seats().trim().split(" +");
            Set<Character> letters = new HashSet<>();
            for (String g : groups)
                for (char ch : g.toCharArray())
                    if (!letters.add(ch)) throw bad(id, "seats에 같은 글자가 두 번 나온다: " + ch);
            Set<Integer> missingRows = new HashSet<>();
            Set<String> missingSeats = new HashSet<>();
            for (String m : nz(c.missing())) {
                Matcher mt = REF.matcher(m);
                if (!mt.matches()) throw bad(id, "missing 표기가 틀렸다: " + m);
                int row = Integer.parseInt(mt.group(1));
                if (row < c.fromRow() || row > c.toRow()) throw bad(id, "missing이 객실 범위 밖이다: " + m);
                if (mt.group(2).isEmpty()) missingRows.add(row);
                else if (!letters.contains(mt.group(2).charAt(0))) throw bad(id, "missing의 좌석이 없다: " + m);
                else missingSeats.add(m);
            }
            for (int n = c.fromRow(); n <= c.toRow(); n++) {
                if (missingRows.contains(n)) continue;
                final int row = n;
                List<String> kept = new ArrayList<>();
                for (String g : groups) {
                    String left = g.chars().mapToObj(ch -> String.valueOf((char) ch))
                            .filter(l -> !missingSeats.contains(row + l)).reduce("", String::concat);
                    kept.add(left);
                }
                rows.add(new Row(n, c, kept));
            }
        }
        return rows;
    }

    /** 좌석 목록 표기("14" 열 전체, "11A" 좌석 하나)를 좌석 번호 집합으로 푼다. 가리키는 곳이 없으면 멈춘다. */
    private static Set<String> refs(String id, String what, List<String> refs, List<Seat> seats) {
        Set<String> out = new HashSet<>();
        for (String ref : refs) out.addAll(resolve(id, what, ref, seats));
        return out;
    }

    private static List<String> resolve(String id, String what, String ref, List<Seat> seats) {
        Matcher m = REF.matcher(ref);
        if (!m.matches()) throw bad(id, what + " 표기가 틀렸다: " + ref);
        List<String> hit = seats.stream()
                .filter(s -> m.group(2).isEmpty() ? s.row() == Integer.parseInt(m.group(1)) : s.seat().equals(ref))
                .map(Seat::seat).toList();
        if (hit.isEmpty()) throw bad(id, what + "이(가) 가리키는 좌석이나 열이 없다: " + ref);
        return hit;
    }

    /** noWindow: 열 전체("29")는 그 열의 창가 좌석, 좌석 하나는 창가여야 한다. */
    private static Set<String> windowless(String id, List<String> refs, List<Seat> seats) {
        Set<String> out = new HashSet<>();
        for (String ref : refs) {
            boolean wholeRow = !Character.isLetter(ref.charAt(ref.length() - 1));
            for (String seatId : resolve(id, "noWindow", ref, seats)) {
                boolean window = seats.stream().anyMatch(s -> s.seat().equals(seatId) && s.position().equals("window"));
                if (window) out.add(seatId);
                else if (!wholeRow) throw bad(id, "noWindow가 창가가 아닌 좌석을 가리킨다: " + ref);
            }
        }
        return out;
    }

    private static <T> List<T> nz(List<T> list) {
        return list == null ? List.of() : list;
    }

    private static IllegalArgumentException bad(String id, String why) {
        return new IllegalArgumentException(id + ": " + why);
    }
}

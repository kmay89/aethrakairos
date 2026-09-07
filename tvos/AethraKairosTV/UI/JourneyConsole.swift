import SwiftUI

/// The Journey Console — the field's cartographer. It does not solve anything:
/// the bit-exact JourneyEngine (ported from the web player's §6c) is the one and
/// only solver, and this screen only turns its dials and reads back the deal.
/// The law here is faithfulness — every Engage builds `elig` and seeds exactly
/// as the shipped ritual path does, so a journey dealt from the couch is the
/// same journey the web would deal from the same seed and the same catalog order.
///
/// Everything is operable with the Siri Remote alone: the map is a read-only
/// picture (a remote can't draw), so FROM/TO are chosen from a focusable list
/// beside it — first press sets FROM, second sets TO, a third starts over.
struct JourneyConsole: View {
    @ObservedObject var player: Player
    let catalog: Catalog
    @Binding var isPresented: Bool

    // The featured pool, in CATALOG ORDER — the solver's rng rides on iteration
    // order, so this must be the same filter the ritual path uses, computed once.
    private let elig: [Track]
    // Distinct album years that carry featured tracks — the Memories eras.
    private let eras: [Int]

    // The face decides which solver call an Engage makes.
    @State private var face: Face = .journey
    // FROM/TO are track keys; nil = unset (a valid state — the solver handles it).
    @State private var fromID: String?
    @State private var toID: String?
    // Heat as an integer count of 0.05 steps, so 0…1 by 0.05 stays exact.
    @State private var heatStep = 5            // 0.25 — a gentle drift by default
    @State private var lengthIndex = 1         // 1 HR
    @State private var eraIndex = 0
    // The last dealt order (drawn on the map) and the summary line.
    @State private var dealtOrder: [String] = []
    @State private var summary: String?

    init(player: Player, catalog: Catalog, isPresented: Binding<Bool>) {
        _player = ObservedObject(wrappedValue: player)
        self.catalog = catalog
        _isPresented = isPresented
        let featured = catalog.tracks.filter { $0.features != nil }
        self.elig = featured
        self.eras = Array(Set(featured.compactMap { $0.year })).sorted()
    }

    // MARK: - the three faces / the length dial

    private enum Face: String, CaseIterable, Hashable {
        case journey = "JOURNEY"
        case quantum = "QUANTUM"
        case memories = "MEMORIES"
    }

    /// The horizon. Time modes hand the solver a fixed target; track modes ask
    /// for roughly N tracks by targeting N × the pool's mean duration.
    private enum JourneyLength: CaseIterable, Hashable {
        case min30, hr1, hr2, tracks12, tracks24
        var label: String {
            switch self {
            case .min30: return "30 MIN"
            case .hr1: return "1 HR"
            case .hr2: return "2 HR"
            case .tracks12: return "12 TRACKS"
            case .tracks24: return "24 TRACKS"
            }
        }
        /// A hard track ceiling for the quantum walk (nil = time-bounded instead).
        var trackCap: Int? {
            switch self {
            case .tracks12: return 12
            case .tracks24: return 24
            default: return nil
            }
        }
        func targetSec(meanDur: Double) -> Double {
            switch self {
            case .min30: return 1800
            case .hr1: return 3600
            case .hr2: return 7200
            case .tracks12: return 12 * max(30, meanDur)
            case .tracks24: return 24 * max(30, meanDur)
            }
        }
    }

    private var length: JourneyLength {
        let all = JourneyLength.allCases
        return all[min(max(lengthIndex, 0), all.count - 1)]
    }
    private var heat: Double { Double(heatStep) * 0.05 }
    private var selectedEra: Int? {
        eras.indices.contains(eraIndex) ? eras[eraIndex] : nil
    }

    // MARK: - body

    var body: some View {
        ZStack {
            Color.akVoid.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 30) {
                header
                HStack(alignment: .top, spacing: 40) {
                    VStack(alignment: .leading, spacing: 16) {
                        JourneyMap(tracks: elig, fromID: fromID, toID: toID, dealt: dealtOrder)
                        fromToReadout
                    }
                    selectionColumn
                    controlsColumn
                }
                ritualsShelf
            }
            .padding(.horizontal, 70)
            .padding(.vertical, 46)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(Color.akVoid.ignoresSafeArea())
        // Menu retreats to the shelves — the console is an interruption of the
        // field, never a place you can get stuck in.
        .onExitCommand { isPresented = false }
    }

    // MARK: - header

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            Text("JOURNEY")
                .font(.system(size: 44, weight: .medium, design: .serif))
                .italic()
                .foregroundStyle(Color.akInk)
            Text("∞")
                .font(.system(size: 34, weight: .regular, design: .serif))
                .foregroundStyle(Color.akIce)
            Spacer(minLength: 24)
            Text("MENU TO CLOSE")
                .font(.system(size: 16, weight: .semibold, design: .monospaced))
                .tracking(3)
                .foregroundStyle(Color.akDim)
        }
    }

    // MARK: - the FROM → TO readout under the map

    private var fromToReadout: some View {
        HStack(spacing: 24) {
            readoutPill("FROM", title: title(for: fromID), tint: .akAmber)
            Text("→")
                .font(.system(size: 24, weight: .regular, design: .monospaced))
                .foregroundStyle(Color.akDim)
            readoutPill("TO", title: title(for: toID), tint: .akIce)
        }
    }

    private func readoutPill(_ label: String, title: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 15, weight: .semibold, design: .monospaced))
                .tracking(3)
                .foregroundStyle(tint)
            Text(title)
                .font(.system(size: 20, design: .serif))
                .italic()
                .foregroundStyle(Color.akInk)
                .lineLimit(1)
        }
        .frame(width: 236, alignment: .leading)
        .padding(.vertical, 12)
        .padding(.horizontal, 18)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.akGlass))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(tint.opacity(0.4), lineWidth: 1))
    }

    private func title(for id: String?) -> String {
        guard let id, let t = elig.first(where: { $0.id == id }) else { return "—" }
        return t.title
    }

    // MARK: - the FROM/TO selection list (the map's remote-friendly hands)

    private var selectionColumn: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("SELECT  FROM → TO")
                .font(.system(size: 17, weight: .semibold, design: .monospaced))
                .tracking(3)
                .foregroundStyle(Color.akDim)
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: 10) {
                    ForEach(elig) { track in
                        trackRow(track)
                    }
                }
                .padding(.trailing, 8)
            }
            .frame(width: 380, height: 440)
        }
        .focusSection()
    }

    private func trackRow(_ track: Track) -> some View {
        let isFrom = track.id == fromID
        let isTo = track.id == toID
        return Button {
            selectTrack(track)
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(track.title)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(isFrom ? Color.akAmber : (isTo ? Color.akIce : Color.akInk))
                        .lineLimit(1)
                    Text(track.albumTitle)
                        .font(.system(size: 15))
                        .foregroundStyle(Color.akDim)
                        .lineLimit(1)
                }
                Spacer(minLength: 6)
                if isFrom { tag("FROM", .akAmber) }
                if isTo { tag("TO", .akIce) }
            }
            .frame(width: 336, alignment: .leading)
            .padding(.vertical, 10)
            .padding(.horizontal, 14)
        }
    }

    private func tag(_ text: String, _ tint: Color) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .bold, design: .monospaced))
            .tracking(2)
            .foregroundStyle(Color.akVoid)
            .padding(.vertical, 4)
            .padding(.horizontal, 10)
            .background(Capsule().fill(tint))
    }

    /// First press sets FROM, the next sets TO, a further press starts a new pair.
    private func selectTrack(_ track: Track) {
        if fromID == nil {
            fromID = track.id
        } else if toID == nil && track.id != fromID {
            toID = track.id
        } else {
            fromID = track.id
            toID = nil
        }
        resetDeal()
    }

    // MARK: - controls (faces, dials, engage, summary)

    private var controlsColumn: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 26) {
                facesRow
                faceHint
                heatDial
                lengthDial
                if face == .memories { eraDial }
                engageButton
                if let summary { summaryView(summary) }
            }
            .padding(.trailing, 8)
        }
        .frame(width: 480, height: 440)
        .focusSection()
    }

    private var facesRow: some View {
        HStack(spacing: 22) {
            ForEach(Face.allCases, id: \.self) { f in
                Button {
                    face = f
                    resetDeal()
                } label: {
                    VStack(spacing: 8) {
                        Text(f.rawValue)
                            .font(.system(size: 22, weight: .semibold, design: .monospaced))
                            .tracking(2)
                            .foregroundStyle(face == f ? Color.akAmber : Color.akInk)
                        Capsule()
                            .fill(face == f ? Color.akAmber : Color.clear)
                            .frame(width: 54, height: 3)
                    }
                }
            }
        }
    }

    private var faceHint: some View {
        Text(hintText)
            .font(.system(size: 17))
            .foregroundStyle(Color.akDim)
            .fixedSize(horizontal: false, vertical: true)
            .frame(width: 460, alignment: .leading)
    }

    private var hintText: String {
        switch face {
        case .journey:
            return "Pick FROM then TO from the list. Heat loosens the path; Length sets the horizon."
        case .quantum:
            return "A memoryless walk — Heat is the only dial. A chosen FROM seeds the first neighbourhood."
        case .memories:
            return "Wander one era of the library. Pick a year; the deal begins at its first track."
        }
    }

    private func dialLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 16, weight: .semibold, design: .monospaced))
            .tracking(4)
            .foregroundStyle(Color.akDim)
    }

    private func stepButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(symbol)
                .font(.system(size: 30, weight: .semibold, design: .monospaced))
                .frame(width: 64, height: 64)
                .foregroundStyle(Color.akInk)
        }
    }

    private var heatDial: some View {
        VStack(alignment: .leading, spacing: 10) {
            dialLabel("HEAT")
            HStack(spacing: 18) {
                stepButton("−") { heatStep = max(0, heatStep - 1); resetDeal() }
                VStack(spacing: 6) {
                    Text(String(format: "%.2f", heat))
                        .font(.system(size: 28, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.akAmber)
                    Text(regime(heat).uppercased())
                        .font(.system(size: 15, weight: .semibold, design: .monospaced))
                        .tracking(3)
                        .foregroundStyle(Color.akDim)
                    Capsule()
                        .fill(Color.akAmber)
                        .frame(width: CGFloat(18 + heat * 90), height: 3)
                }
                .frame(width: 180)
                stepButton("+") { heatStep = min(20, heatStep + 1); resetDeal() }
            }
        }
    }

    private var lengthDial: some View {
        VStack(alignment: .leading, spacing: 10) {
            dialLabel("LENGTH")
            HStack(spacing: 18) {
                stepButton("−") { lengthIndex = max(0, lengthIndex - 1); resetDeal() }
                Text(length.label)
                    .font(.system(size: 26, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.akInk)
                    .frame(width: 180)
                stepButton("+") {
                    lengthIndex = min(JourneyLength.allCases.count - 1, lengthIndex + 1)
                    resetDeal()
                }
            }
        }
    }

    private var eraDial: some View {
        VStack(alignment: .leading, spacing: 10) {
            dialLabel("ERA")
            if eras.isEmpty {
                Text("NO DATED ALBUMS")
                    .font(.system(size: 20, design: .monospaced))
                    .foregroundStyle(Color.akDim)
            } else {
                HStack(spacing: 18) {
                    stepButton("−") { eraIndex = max(0, eraIndex - 1); resetDeal() }
                    Text(String(selectedEra ?? eras[0]))
                        .font(.system(size: 30, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.akIce)
                        .frame(width: 160)
                    stepButton("+") { eraIndex = min(eras.count - 1, eraIndex + 1); resetDeal() }
                }
            }
        }
    }

    private var engageButton: some View {
        Button {
            engage()
        } label: {
            Text("ENGAGE")
                .font(.system(size: 26, weight: .semibold, design: .monospaced))
                .tracking(5)
                .foregroundStyle(Color.akVoid)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.akAmber))
        }
        .frame(width: 300)
        .padding(.top, 4)
    }

    private func summaryView(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 19, weight: .semibold, design: .monospaced))
            .foregroundStyle(Color.akAmber)
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
            .frame(width: 460, alignment: .leading)
    }

    // MARK: - rituals (mirrored from the home shelf for discovery)

    private var ritualsShelf: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("RITUALS")
                .font(.system(size: 17, weight: .semibold, design: .monospaced))
                .tracking(4)
                .foregroundStyle(Color.akDim)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 20) {
                    ForEach(JourneyEngine.rituals) { ritual in
                        ritualChip(ritual)
                    }
                }
                .padding(.vertical, 8)
            }
        }
        .focusSection()
    }

    private func ritualChip(_ ritual: Ritual) -> some View {
        Button {
            engageRitual(ritual)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(ritual.label.uppercased())
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Color.akInk)
                    .lineLimit(1)
                HStack(spacing: 8) {
                    Capsule()
                        .fill(Color.akAmber)
                        .frame(width: CGFloat(14 + ritual.heat * 48), height: 3)
                    Text("\(Int((ritual.targetSec / 60).rounded())) MIN")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.akDim)
                }
            }
            .frame(width: 220, alignment: .leading)
            .padding(14)
        }
    }

    // MARK: - the deals (all roads lead to JourneyEngine + engageJourney)

    /// The one true build of the eligible pool + seed, shared by every deal so
    /// the console is bit-identical to the shipped ritual path.
    private func engage() {
        guard elig.count >= 2 else {
            summary = "need at least two featured tracks"
            return
        }
        let seed = UInt32.random(in: UInt32.min ... UInt32.max)
        let rng = JourneyEngine.mulberry32(seed)
        let meanDur = elig.reduce(0.0) { $0 + ($1.duration ?? 240) } / Double(elig.count)

        var order: [String] = []
        var total = 0.0

        switch face {
        case .journey:
            let deal = JourneyEngine.dealJourney(
                tracks: elig,
                fromFeat: point(for: fromID),
                toFeat: point(for: toID),
                targetSec: length.targetSec(meanDur: meanDur),
                heat: heat,
                rng: rng
            )
            order = deal.order
            total = deal.totalSec

        case .quantum:
            // The memoryless walk: step until the horizon, exhaustion, or the
            // whole pool is spent. The pool size is the natural hard bound.
            let target = length.targetSec(meanDur: meanDur)
            var used = Set<String>()
            var current = point(for: fromID)
            var steps = 0
            while steps < elig.count {
                steps += 1
                let step = JourneyEngine.quantumStep(
                    tracks: elig,
                    currentFeat: current,
                    heat: heat,
                    usedKeys: used,
                    heartKeys: [],
                    rng: rng
                )
                if step.exhausted { break }
                guard let key = step.pickKey else { break }
                used.insert(key)
                order.append(key)
                if let t = elig.first(where: { $0.id == key }) {
                    total += t.duration ?? meanDur
                    current = t.features.map { FeaturePoint($0) }
                }
                if let cap = length.trackCap {
                    if order.count >= cap { break }
                } else if total >= target {
                    break
                }
            }

        case .memories:
            guard let era = selectedEra else {
                summary = "no dated albums to wander"
                return
            }
            let eraTracks = elig.filter { $0.year == era }
            guard eraTracks.count >= 2, let firstFeat = eraTracks.first?.features else {
                summary = "not enough featured tracks from \(era)"
                return
            }
            let em = eraTracks.reduce(0.0) { $0 + ($1.duration ?? 240) } / Double(eraTracks.count)
            let deal = JourneyEngine.dealJourney(
                tracks: eraTracks,
                fromFeat: FeaturePoint(firstFeat),
                toFeat: nil,
                targetSec: length.targetSec(meanDur: em),
                heat: heat,
                rng: rng
            )
            order = deal.order
            total = deal.totalSec
        }

        guard !order.isEmpty else {
            summary = "no journey could be dealt"
            return
        }
        dealtOrder = order
        player.engageJourney(order: order, in: catalog)
        summary = "\(order.count) TRACKS · \(clock(total)) · SEED \(seed)"
        retreatToField()
    }

    /// A ritual is dials pre-turned: the same solver, one press, ignoring the
    /// console's own face and dials — verbatim with the home-shelf ritual path.
    private func engageRitual(_ ritual: Ritual) {
        guard elig.count >= 2 else {
            summary = "need at least two featured tracks"
            return
        }
        let seed = UInt32.random(in: UInt32.min ... UInt32.max)
        let deal = JourneyEngine.dealJourney(
            tracks: elig,
            fromFeat: ritual.from,
            toFeat: ritual.to,
            targetSec: ritual.targetSec,
            heat: ritual.heat,
            rng: JourneyEngine.mulberry32(seed)
        )
        guard !deal.order.isEmpty else {
            summary = "no journey could be dealt"
            return
        }
        dealtOrder = deal.order
        player.engageJourney(order: deal.order, in: catalog)
        summary = "\(ritual.label.uppercased()) · \(deal.order.count) TRACKS · \(clock(deal.totalSec))"
        retreatToField()
    }

    /// The summary breathes, then the console retreats and the field takes over.
    private func retreatToField() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.9) {
            isPresented = false
        }
    }

    private func point(for id: String?) -> FeaturePoint? {
        guard let id, let f = elig.first(where: { $0.id == id })?.features else { return nil }
        return FeaturePoint(f)
    }

    private func regime(_ h: Double) -> String {
        if h < 0.25 { return "coherent" }
        if h < 0.5 { return "drifting" }
        if h < 0.75 { return "entangled" }
        return "chaotic"
    }

    private func clock(_ sec: Double) -> String {
        let m = Int((sec / 60).rounded())
        if m >= 60 { return "\(m / 60)H \(m % 60)M" }
        return "\(m)M"
    }

    private func resetDeal() {
        dealtOrder = []
        summary = nil
    }
}

// MARK: - the map

/// The library as a picture: every featured track a dot at x = brightness,
/// y = 1 − energy, coloured amber→ice by brightness, sized by onsets. FROM wears
/// an amber ring, TO an ice ring, and a dealt journey is traced as a faint
/// polyline through its tracks. Read-only by design — the Siri Remote cannot
/// draw, so the picking lives in the focusable list beside it.
private struct JourneyMap: View {
    let tracks: [Track]
    let fromID: String?
    let toID: String?
    let dealt: [String]

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18).fill(Color.akGlass)
            RoundedRectangle(cornerRadius: 18).strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
            Canvas { context, size in
                draw(&context, size: size)
            }
            .padding(4)
        }
        .frame(width: 560, height: 440)
    }

    private func draw(_ context: inout GraphicsContext, size: CGSize) {
        let pad: CGFloat = 32
        let w = size.width
        let h = size.height
        guard w > 2 * pad, h > 2 * pad else { return }
        let iw = w - 2 * pad
        let ih = h - 2 * pad

        // A lookup so the path can find each dealt track's coordinate.
        var feat: [String: Features] = [:]
        feat.reserveCapacity(tracks.count)
        for t in tracks {
            if let f = t.features { feat[t.id] = f }
        }

        func pos(_ f: Features) -> CGPoint {
            let fx = min(max(f.brightness, 0), 1)
            let fy = min(max(1 - f.energy, 0), 1)     // high energy rides the top
            return CGPoint(x: pad + CGFloat(fx) * iw, y: pad + CGFloat(fy) * ih)
        }

        // Faint quartile grid.
        var grid = Path()
        for i in 1..<4 {
            let gx = pad + iw * CGFloat(i) / 4
            grid.move(to: CGPoint(x: gx, y: pad))
            grid.addLine(to: CGPoint(x: gx, y: pad + ih))
            let gy = pad + ih * CGFloat(i) / 4
            grid.move(to: CGPoint(x: pad, y: gy))
            grid.addLine(to: CGPoint(x: pad + iw, y: gy))
        }
        context.stroke(grid, with: .color(Color.white.opacity(0.05)), lineWidth: 1)

        // The dealt path, drawn under the dots so the stations sit on top.
        if dealt.count >= 2 {
            var line = Path()
            var started = false
            for id in dealt {
                guard let f = feat[id] else { continue }
                let p = pos(f)
                if started {
                    line.addLine(to: p)
                } else {
                    line.move(to: p)
                    started = true
                }
            }
            context.stroke(line, with: .color(Color.akIce.opacity(0.30)), lineWidth: 2)
        }

        // Every featured track.
        for t in tracks {
            guard let f = t.features else { continue }
            let p = pos(f)
            let r = 3 + CGFloat(min(max(f.onsets, 0), 1)) * 7
            let rect = CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)
            context.fill(Path(ellipseIn: rect), with: .color(dotColor(f.brightness).opacity(0.9)))
        }

        // The endpoints wear their rings.
        if let id = fromID, let f = feat[id] {
            ring(&context, at: pos(f), color: Color.akAmber)
        }
        if let id = toID, let f = feat[id] {
            ring(&context, at: pos(f), color: Color.akIce)
        }

        // Axis whispers.
        context.draw(
            Text("BRIGHT →").font(.system(size: 15, design: .monospaced)).foregroundStyle(Color.akDim),
            at: CGPoint(x: pad + iw - 4, y: pad + ih + 14), anchor: .trailing
        )
        context.draw(
            Text("↑ ENERGY").font(.system(size: 15, design: .monospaced)).foregroundStyle(Color.akDim),
            at: CGPoint(x: pad + 2, y: pad - 14), anchor: .leading
        )
    }

    private func ring(_ context: inout GraphicsContext, at point: CGPoint, color: Color) {
        let r: CGFloat = 15
        let rect = CGRect(x: point.x - r, y: point.y - r, width: r * 2, height: r * 2)
        context.stroke(Path(ellipseIn: rect), with: .color(color), lineWidth: 3)
    }

    /// amber #ffb454 → ice #6ee7ff, linear in brightness.
    private func dotColor(_ brightness: Double) -> Color {
        let b = min(max(brightness, 0), 1)
        let ar = 1.0, ag = 180.0 / 255, ab = 84.0 / 255
        let ir = 110.0 / 255, ig = 231.0 / 255, ib = 1.0
        return Color(red: ar + (ir - ar) * b,
                     green: ag + (ig - ag) * b,
                     blue: ab + (ib - ab) * b)
    }
}

// Identity tokens (DESIGN §2) — void ground, ink, dim, the two axes, and the
// console's frosted glass. File-private, matching the other UI files.
private extension Color {
    static let akVoid = Color(red: 5 / 255, green: 6 / 255, blue: 14 / 255)
    static let akInk = Color(red: 233 / 255, green: 237 / 255, blue: 246 / 255)
    static let akDim = Color(red: 154 / 255, green: 165 / 255, blue: 188 / 255)
    static let akAmber = Color(red: 255 / 255, green: 180 / 255, blue: 84 / 255)
    static let akIce = Color(red: 110 / 255, green: 231 / 255, blue: 255 / 255)
    static let akGlass = Color(red: 10 / 255, green: 13 / 255, blue: 24 / 255).opacity(0.55)
}

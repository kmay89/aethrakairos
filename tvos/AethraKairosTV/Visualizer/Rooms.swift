import Foundation
import UIKit

/* ================================================================
   THE ROOMS AND THE DIRECTOR — taste, not shuffle.
   A room is not a filter preset; it has an appetite. The director
   deals the next room by scoring each appetite against the moment
   (energy, calm, onset, treble, mid, bass, entropy), taxing the
   recently seen (a ring of the last five — the freshest pays the
   most to return), lifting the never-shown by 1.55x so a night
   eventually tours the whole house, and biasing by the MOOD of the
   moment (heavy rooms at the apex, calm rooms adrift).

   Above the deal sits the STORY: five acts read off the track's
   position — OVERTURE, RISING, APEX, TURN, RESOLVE — centered on the
   apex. The act sets a dwell multiplier (linger in an overture, cut
   fast at the apex) and, through the renderer, the white budget and
   the eased `act` uniform. Dwell is 16–46 s scaled by calm, then by
   mood and act, floored at 7 s. A switch only ever LANDS ON A
   BOUNDARY — a big change (a mood turn) waits for a phrase wrap, a
   small one for a bar wrap, and neither waits longer than 4 s. A cut
   off the grid is a flinch, not a decision.
   ================================================================ */

struct Room: Identifiable, Equatable {
    var id: String { key }
    var key: String
    var name: String                 // ALL CAPS in the UI — names are canon
    var fragmentFunction: String     // metal function name, e.g. "room_spiral"
    // the appetite: positive = wants the feature, negative = wants its absence.
    // The wave-1 four stay the public contract; wave 2 appends three more and
    // two mood flags, all defaulted so a wave-1 Room(...) still compiles.
    var tasteEnergy: Float
    var tasteCalm: Float
    var tasteBeat: Float
    var tasteTreble: Float
    var tasteMid: Float = 0
    var tasteBass: Float = 0
    var tasteEntropy: Float = 0
    var heavy: Bool = false           // raymarched / fluid — favoured at the apex
    var calm: Bool = false            // a room to be lived in — favoured adrift
}

enum Rooms {
    /// Build order is the index space the director and renderer share.
    /// The first six are wave 1; the next eight are wave 2 (Shaders2/Shaders3);
    /// then eight wave 3 (Shaders4/Shaders5); four wave 4 (Shaders6); and the
    /// next four wave 5 (Shaders7); then twelve wave 6, the chaos wing
    /// (Shaders8/Shaders9); seven wave 7, the counting wing (Shaders10);
    /// and the last eleven are wave 8, the founding wing (Shaders11) —
    /// the house stands at sixty, 1:1 with the web roster. Every
    /// fragment function is trusted to exist at link time — one target, one
    /// default library, so a room registered here whose function is missing
    /// simply parks the renderer in the void (configure() bails), never a
    /// half-built roster.
    static let all: [Room] = [
        Room(key: "spiral", name: "MÖBIUS SPIRAL", fragmentFunction: "room_spiral",
             tasteEnergy: 0.9, tasteCalm: 0.2, tasteBeat: 0.7, tasteTreble: 0.3),
        Room(key: "pulse", name: "PULSE", fragmentFunction: "room_pulse",
             tasteEnergy: 0.3, tasteCalm: 1.1, tasteBeat: 1.4, tasteTreble: 0.2, calm: true),
        Room(key: "nebula", name: "NEBULA", fragmentFunction: "room_nebula",
             tasteEnergy: -0.9, tasteCalm: 1.6, tasteBeat: -0.4, tasteTreble: 0.3, calm: true),
        Room(key: "tunnel", name: "TUNNEL", fragmentFunction: "room_tunnel",
             tasteEnergy: 1.7, tasteCalm: -0.5, tasteBeat: 0.8, tasteTreble: 0.2),
        Room(key: "opart", name: "OP-ART", fragmentFunction: "room_opart",
             tasteEnergy: 0.8, tasteCalm: 0.1, tasteBeat: 1.0, tasteTreble: 0.9),
        Room(key: "scope", name: "SCOPE", fragmentFunction: "room_scope",
             tasteEnergy: 0.2, tasteCalm: 1.0, tasteBeat: 0.4, tasteTreble: 0.7, calm: true),

        // ---- wave 2 ----
        Room(key: "fractal", name: "FRACTAL FIELD", fragmentFunction: "room_fractal",
             tasteEnergy: 1.2, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: 1.0, heavy: true),
        Room(key: "pyro", name: "FIREWORKS", fragmentFunction: "room_pyro",
             tasteEnergy: 1.5, tasteCalm: 0, tasteBeat: 2.0, tasteTreble: 0),
        // key matches the web roster ("oilslick") — the parity law's 1:1 contract
        Room(key: "oilslick", name: "OIL FILM", fragmentFunction: "room_oilfilm",
             tasteEnergy: 0, tasteCalm: 1.2, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: 0.8, calm: true),
        Room(key: "mandala", name: "MANDALA", fragmentFunction: "room_mandala",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0, tasteMid: 1.2),
        Room(key: "halo", name: "HALO", fragmentFunction: "room_halo",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.8, tasteTreble: 0, tasteBass: 1.4),
        Room(key: "terrain", name: "TERRAIN", fragmentFunction: "room_terrain",
             tasteEnergy: -0.6, tasteCalm: 1.4, tasteBeat: 0, tasteTreble: 0,
             heavy: true, calm: true),
        Room(key: "starburst", name: "STARBURST", fragmentFunction: "room_starburst",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 2.0, tasteTreble: 1.2),
        Room(key: "lava", name: "LAVA LAMP", fragmentFunction: "room_lava",
             tasteEnergy: -1.0, tasteCalm: 1.6, tasteBeat: 0, tasteTreble: 0, calm: true),

        // ---- wave 3 ----
        // Taste is the four canonical appetites only (WAVE3.md §A pins the
        // vectors onto tasteEnergy/tasteCalm/tasteBeat/tasteTreble); the fragment
        // bodies live in Shaders4.metal (eigen/aurea/mandel/rosette) and
        // Shaders5.metal (parlor/disperse/creature/slinky).
        Room(key: "eigen", name: "EIGENSTATE", fragmentFunction: "room_eigen",
             tasteEnergy: 0.3, tasteCalm: 0.4, tasteBeat: 0, tasteTreble: 0),
        Room(key: "aurea", name: "AUREA", fragmentFunction: "room_aurea",
             tasteEnergy: 0, tasteCalm: 1.0, tasteBeat: 0, tasteTreble: 0.6),
        Room(key: "mandel", name: "FILIGREE", fragmentFunction: "room_mandel",
             tasteEnergy: -0.4, tasteCalm: 1.2, tasteBeat: 0, tasteTreble: 0),
        Room(key: "rosette", name: "ROSETTE", fragmentFunction: "room_rosette",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.7, tasteTreble: 1.0),
        Room(key: "parlor", name: "PARLOR", fragmentFunction: "room_parlor",
             tasteEnergy: 0, tasteCalm: 1.3, tasteBeat: -0.3, tasteTreble: 0),
        Room(key: "disperse", name: "DISPERSION", fragmentFunction: "room_disperse",
             tasteEnergy: 0.4, tasteCalm: 0, tasteBeat: 0, tasteTreble: 1.2),
        Room(key: "creature", name: "CREATURE", fragmentFunction: "room_creature",
             tasteEnergy: 0.8, tasteCalm: 0, tasteBeat: 0.8, tasteTreble: 0),
        Room(key: "slinky", name: "SLINKY", fragmentFunction: "room_slinky",
             tasteEnergy: -0.6, tasteCalm: 1.4, tasteBeat: 0, tasteTreble: 0),

        // ---- wave 4 ----
        // The last four, closing the house at twenty-six. Taste is the four
        // canonical appetites only (WAVE4.md §A pins the vectors); the fragment
        // bodies live in Shaders6.metal (arcade/sky/barkley/verse). VERSE also
        // reads the 256x64 text-mask texture the renderer binds at texture(2).
        Room(key: "arcade", name: "ARCADE", fragmentFunction: "room_arcade",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 1.6, tasteTreble: 0.8),
        Room(key: "sky", name: "CONSTELLATIONS", fragmentFunction: "room_sky",
             tasteEnergy: -0.7, tasteCalm: 1.5, tasteBeat: 0, tasteTreble: 0),
        Room(key: "barkley", name: "EXCITABLE", fragmentFunction: "room_barkley",
             tasteEnergy: 0.7, tasteCalm: 0, tasteBeat: 0.6, tasteTreble: 0),
        Room(key: "verse", name: "VERSE", fragmentFunction: "room_verse",
             tasteEnergy: 0, tasteCalm: 0.8, tasteBeat: 0, tasteTreble: 0.6),

        // ---- wave 5 ----
        // The web player's scenes 38–41, told in Metal (Shaders7.metal):
        // the girih star lattice, the ray-marched storm sea (heavy — one
        // regula-falsi trace and three fine normals per pixel), the arc,
        // and the thinking circuit board. Tastes mirror the web roster's:
        // the lattice wants held tonal material, the sea wants weather,
        // the arc wants onsets, the machine wants a pulse and order.
        Room(key: "weave", name: "ARABESQUE", fragmentFunction: "room_weave",
             tasteEnergy: 0, tasteCalm: 0.9, tasteBeat: 0, tasteTreble: 0, tasteMid: 0.8),
        Room(key: "ocean", name: "MAELSTROM", fragmentFunction: "room_ocean",
             tasteEnergy: 1.4, tasteCalm: -0.5, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 1.2, heavy: true),
        Room(key: "bolt", name: "VOLTAGE", fragmentFunction: "room_bolt",
             tasteEnergy: 0.8, tasteCalm: -0.6, tasteBeat: 1.5, tasteTreble: 0.9),
        Room(key: "circuit", name: "SILICON", fragmentFunction: "room_circuit",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 1.2, tasteTreble: 0.6),

        // ---- wave 6: the chaos wing ----
        // The web player's scenes 42–53, retold in Metal (Shaders8/Shaders9)
        // under the ARCADE's closed-form licence. Tastes mirror the web
        // roster's appetites; the two ray-marchers and the two live
        // integrators carry the heavy flag the raymarchers before them do.
        Room(key: "bifurc", name: "FEIGENBAUM", fragmentFunction: "room_bifurc",
             tasteEnergy: 0.9, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0, tasteEntropy: 0.9),
        Room(key: "cymatic", name: "CHLADNI", fragmentFunction: "room_cymatic",
             tasteEnergy: 0, tasteCalm: 0.6, tasteBeat: 0, tasteTreble: 0, tasteMid: 1.2),
        Room(key: "rule", name: "AUTOMATON", fragmentFunction: "room_rule",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 1.3, tasteTreble: 0.7, tasteEntropy: 0.5),
        Room(key: "hole", name: "EVENT HORIZON", fragmentFunction: "room_hole",
             tasteEnergy: 0.5, tasteCalm: 0.8, tasteBeat: -0.3, tasteTreble: 0,
             tasteBass: 1.2, heavy: true),
        Room(key: "ferro", name: "FERROFLUID", fragmentFunction: "room_ferro",
             tasteEnergy: 0, tasteCalm: -0.3, tasteBeat: 1.0, tasteTreble: 0,
             tasteBass: 1.6, heavy: true),
        Room(key: "plinko", name: "GALTON", fragmentFunction: "room_plinko",
             tasteEnergy: 0.6, tasteCalm: 0, tasteBeat: 1.5, tasteTreble: 0.6),
        Room(key: "pendula", name: "PENDULA", fragmentFunction: "room_pendula",
             tasteEnergy: 0.7, tasteCalm: 0.4, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: 1.0, heavy: true),
        Room(key: "lorenz", name: "ATTRACTOR", fragmentFunction: "room_lorenz",
             tasteEnergy: 0.6, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: 1.1, heavy: true),
        Room(key: "sync", name: "FIREFLIES", fragmentFunction: "room_sync",
             tasteEnergy: 0, tasteCalm: 0.4, tasteBeat: 1.3, tasteTreble: 0, calm: true),
        Room(key: "nbody", name: "THREE BODY", fragmentFunction: "room_nbody",
             tasteEnergy: 0, tasteCalm: 1.1, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 0.6, calm: true),
        Room(key: "dla", name: "DENDRITE", fragmentFunction: "room_dla",
             tasteEnergy: 0, tasteCalm: 1.2, tasteBeat: -0.4, tasteTreble: 0.8, calm: true),
        Room(key: "boids", name: "MURMURATION", fragmentFunction: "room_boids",
             tasteEnergy: 0.7, tasteCalm: 0.9, tasteBeat: 0, tasteTreble: 0.5),

        // ---- wave 7: the counting wing ----
        // The web player's scenes 54–60, retold in Metal (Shaders10) under
        // the closed-form licence — the house stands at forty-nine. Tastes
        // mirror the web roster's; JULIA iterates 96 deep and carries the
        // heavy flag, PHYLLOTAXIS is a room to be lived in.
        Room(key: "fourier", name: "FOURIER", fragmentFunction: "room_fourier",
             tasteEnergy: 0.7, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0.9, tasteMid: 0.5, heavy: true),
        Room(key: "fringe", name: "INTERFERENCE", fragmentFunction: "room_fringe",
             tasteEnergy: 0, tasteCalm: 0.4, tasteBeat: 0.6, tasteTreble: 0, tasteMid: 0.8),
        Room(key: "julia", name: "JULIA", fragmentFunction: "room_julia",
             tasteEnergy: 0.9, tasteCalm: 0, tasteBeat: 0.6, tasteTreble: 0,
             tasteEntropy: 0.7, heavy: true),
        Room(key: "escher", name: "POINCARÉ", fragmentFunction: "room_escher",
             tasteEnergy: 0, tasteCalm: 0.8, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 0.7, tasteEntropy: -0.5, heavy: true),
        Room(key: "penrose", name: "QUASICRYSTAL", fragmentFunction: "room_penrose",
             tasteEnergy: 0, tasteCalm: 0.5, tasteBeat: 0, tasteTreble: 0.9, tasteMid: 0.4),
        Room(key: "sunflower", name: "PHYLLOTAXIS", fragmentFunction: "room_sunflower",
             tasteEnergy: -0.2, tasteCalm: 1.2, tasteBeat: 0.7, tasteTreble: 0, heavy: true, calm: true),
        Room(key: "sandpile", name: "SANDPILE", fragmentFunction: "room_sandpile",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 1.4, tasteTreble: 0,
             tasteBass: 0.8, tasteEntropy: 0.5),

        // ---- wave 8: the founding wing ----
        // The web player's eleven earliest scenes, retold in Metal
        // (Shaders11) — the parity law's debt paid: from here the two
        // rosters are 1:1 by key, sixty rooms on both stages, and every
        // future wave ships web and Metal together (CONTRIBUTING.md).
        Room(key: "helix", name: "π–e HELIX", fragmentFunction: "room_helix",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0, tasteTreble: 1.5, tasteBass: 1.5, heavy: true),
        Room(key: "band", name: "MÖBIUS BAND", fragmentFunction: "room_band",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 1.5, tasteEntropy: -1.0, heavy: true),
        Room(key: "ribbons", name: "RIBBONS", fragmentFunction: "room_ribbons",
             tasteEnergy: 0, tasteCalm: 1.2, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: 1.5, heavy: true, calm: true),
        Room(key: "comets", name: "COMETS", fragmentFunction: "room_comets",
             tasteEnergy: 1.5, tasteCalm: 0, tasteBeat: 1.2, tasteTreble: 0, heavy: true),
        Room(key: "fern", name: "FERN", fragmentFunction: "room_fern",
             tasteEnergy: 0, tasteCalm: 1.6, tasteBeat: -0.8, tasteTreble: 0, calm: true),
        Room(key: "flame", name: "FLAME", fragmentFunction: "room_flame",
             tasteEnergy: 0, tasteCalm: 1.3, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: -0.4, calm: true),
        Room(key: "sheets", name: "CUBE SHEETS", fragmentFunction: "room_sheets",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 1.4, tasteTreble: 0,
             tasteBass: 1.0, tasteEntropy: -0.5, heavy: true),
        Room(key: "bubbles", name: "BUBBLES", fragmentFunction: "room_bubbles",
             tasteEnergy: -0.6, tasteCalm: 1.1, tasteBeat: 0, tasteTreble: 0.7, calm: true),
        Room(key: "drift", name: "DRIFT", fragmentFunction: "room_drift",
             tasteEnergy: -0.8, tasteCalm: 1.4, tasteBeat: -0.5, tasteTreble: 0, calm: true),
        Room(key: "filament", name: "FILAMENT", fragmentFunction: "room_filament",
             tasteEnergy: 1.1, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0.6,
             tasteMid: 0.5, heavy: true),
        Room(key: "soapfilm", name: "SOAP FILM", fragmentFunction: "room_soapfilm",
             tasteEnergy: 0, tasteCalm: 1.2, tasteBeat: -0.4, tasteTreble: 0,
             tasteEntropy: 0.8, heavy: true),

        // ---- wave 9: the infinite wing ----
        // Prusinkiewicz & Lindenmayer's algorithmic garden (Shaders12):
        // infinite lengths in finite spaces, sixty-five on both stages.
        Room(key: "lsystem", name: "LINDENMAYER", fragmentFunction: "room_lsystem",
             tasteEnergy: 0, tasteCalm: 1.3, tasteBeat: -0.3, tasteTreble: 0,
             tasteBass: 0.6, calm: true),
        Room(key: "hilbert", name: "HILBERT", fragmentFunction: "room_hilbert",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.9, tasteTreble: 0,
             tasteMid: 0.7, tasteEntropy: -0.4),
        Room(key: "koch", name: "KOCH", fragmentFunction: "room_koch",
             tasteEnergy: 0, tasteCalm: 0.6, tasteBeat: 0, tasteTreble: 0.9,
             tasteEntropy: 0.4),
        Room(key: "dragon", name: "DRAGON", fragmentFunction: "room_dragon",
             tasteEnergy: 0.8, tasteCalm: 0, tasteBeat: 1.2, tasteTreble: 0, heavy: true),
        Room(key: "cantor", name: "CANTOR", fragmentFunction: "room_cantor",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 1.0, tasteTreble: 0.5,
             tasteEntropy: 0.6),

        // ---- wave 10: the harmony wing ----
        // The mathematics OF music (Shaders13): real chroma from the log
        // bands, just intervals, the harmonic series, Euclid's rhythms,
        // Reich's phasing — seventy rooms, 1:1 both stages.
        Room(key: "tonnetz", name: "TONNETZ", fragmentFunction: "room_tonnetz",
             tasteEnergy: 0, tasteCalm: 0.4, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.9, tasteEntropy: -0.3, heavy: true),
        Room(key: "harmonograph", name: "HARMONOGRAPH", fragmentFunction: "room_harmonograph",
             tasteEnergy: 0, tasteCalm: 1.2, tasteBeat: -0.3, tasteTreble: 0.4,
             heavy: true, calm: true),
        Room(key: "overtones", name: "OVERTONES", fragmentFunction: "room_overtones",
             tasteEnergy: 0, tasteCalm: 0.4, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.7, tasteBass: 0.6),
        Room(key: "euclid", name: "EUCLID", fragmentFunction: "room_euclid",
             tasteEnergy: 0.6, tasteCalm: 0, tasteBeat: 1.5, tasteTreble: 0),
        Room(key: "phase", name: "PHASE", fragmentFunction: "room_phase",
             tasteEnergy: 0, tasteCalm: 0.8, tasteBeat: 0.4, tasteTreble: 0,
             tasteEntropy: 0.5, calm: true),

        // ---- wave 11: the number wing ----
        // Arithmetic on stage (Shaders14): live primality, the times
        // table's envelope, hailstone journeys, Ford's kissing circles,
        // the walk along the critical line — seventy-five, both stages.
        Room(key: "ulam", name: "ULAM", fragmentFunction: "room_ulam",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.7, tasteTreble: 0.8,
             tasteEntropy: 0.4),
        Room(key: "cardioid", name: "CARDIOID", fragmentFunction: "room_cardioid",
             tasteEnergy: 0, tasteCalm: 0.5, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.8, tasteEntropy: -0.3, heavy: true),
        Room(key: "collatz", name: "COLLATZ", fragmentFunction: "room_collatz",
             tasteEnergy: 0, tasteCalm: 1.1, tasteBeat: -0.2, tasteTreble: 0,
             tasteBass: 0.6, heavy: true, calm: true),
        Room(key: "mediant", name: "MEDIANT", fragmentFunction: "room_mediant",
             tasteEnergy: 0, tasteCalm: 0.6, tasteBeat: 0, tasteTreble: 0.9,
             tasteEntropy: 0.3),
        Room(key: "zeta", name: "ZETA", fragmentFunction: "room_zeta",
             tasteEnergy: 0.4, tasteCalm: 0.7, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.6, heavy: true),

        // ---- wave 12: flow & knots ----
        // Motion and entanglement (Shaders15): the vortex street's honest
        // streamfunction, the pool's true curvature, the Hopf fibration,
        // the (p,q) windings, Rayleigh's rolls — eighty, both stages.
        Room(key: "karman", name: "KÁRMÁN", fragmentFunction: "room_karman",
             tasteEnergy: 0.7, tasteCalm: 0, tasteBeat: 0.4, tasteTreble: 0,
             tasteBass: 0.7),
        Room(key: "caustics", name: "CAUSTICS", fragmentFunction: "room_caustics",
             tasteEnergy: 0, tasteCalm: 0.9, tasteBeat: -0.2, tasteTreble: 0.6,
             calm: true),
        Room(key: "hopf", name: "HOPF", fragmentFunction: "room_hopf",
             tasteEnergy: 0, tasteCalm: 0.8, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 0.5, tasteEntropy: -0.3, heavy: true, calm: true),
        Room(key: "knots", name: "KNOTS", fragmentFunction: "room_knots",
             tasteEnergy: 0, tasteCalm: 0.3, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.7, tasteBass: 0.6, heavy: true),
        Room(key: "benard", name: "BÉNARD", fragmentFunction: "room_benard",
             tasteEnergy: 0.4, tasteCalm: 0.4, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 0.9, calm: true),

        // ---- wave 13: the sky ----
        // The astronomy wing (Shaders16): Kepler's clockwork solved honestly,
        // the thin-lens equation bending a deep field, the lighthouse that
        // keeps time, the year photographed, and the appointment the sky
        // keeps to the minute — eighty-five, both stages.
        Room(key: "orrery", name: "ORRERY", fragmentFunction: "room_orrery",
             tasteEnergy: 0, tasteCalm: 0.8, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: -0.4, heavy: true, calm: true),
        Room(key: "lensing", name: "LENSING", fragmentFunction: "room_lensing",
             tasteEnergy: 0, tasteCalm: 0.6, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 0.9),
        Room(key: "pulsar", name: "PULSAR", fragmentFunction: "room_pulsar",
             tasteEnergy: 0.5, tasteCalm: 0, tasteBeat: 1.4, tasteTreble: 0.6),
        Room(key: "analemma", name: "ANALEMMA", fragmentFunction: "room_analemma",
             tasteEnergy: 0, tasteCalm: 1.0, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.4, tasteEntropy: -0.5, calm: true),
        Room(key: "eclipse", name: "ECLIPSE", fragmentFunction: "room_eclipse",
             tasteEnergy: 0.9, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 0.7),

        // ---- wave 14: the word ----
        // The language wing (Shaders17): the song speaking morse, the navy's
        // alphabet of arm pairs, an asemic hand writing in musical time, a
        // real dot-matrix alphabet on cipher rings, and Borges' library
        // falling past forever — ninety, both stages.
        Room(key: "telegraph", name: "TELEGRAPH", fragmentFunction: "room_telegraph",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 1.3, tasteTreble: 0.5,
             tasteEntropy: -0.3),
        Room(key: "semaphore", name: "SEMAPHORE", fragmentFunction: "room_semaphore",
             tasteEnergy: 0, tasteCalm: 0.5, tasteBeat: 1.0, tasteTreble: 0),
        Room(key: "scribe", name: "SCRIBE", fragmentFunction: "room_scribe",
             tasteEnergy: 0, tasteCalm: 1.1, tasteBeat: -0.2, tasteTreble: 0,
             tasteMid: 0.5, calm: true),
        Room(key: "cipher", name: "CIPHER", fragmentFunction: "room_cipher",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.5, tasteTreble: 0,
             tasteMid: 0.6, tasteEntropy: 0.8, heavy: true),
        Room(key: "babel", name: "BABEL", fragmentFunction: "room_babel",
             tasteEnergy: 0, tasteCalm: 0.9, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 0.5, tasteEntropy: 0.5, calm: true),

        // ---- wave 15: the icons ----
        // The images everyone half-knows, done honestly (Shaders18): glyph
        // rain hiding a raymarched form, the real continents bit by bit,
        // Navier-Stokes only where it surrenders exactly, hydrogen's true
        // wavefunctions, and B-DNA to the letter — ninety-five, both stages.
        Room(key: "rain", name: "RAIN", fragmentFunction: "room_rain",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.7, tasteTreble: 0.8,
             tasteEntropy: 0.4, heavy: true),
        Room(key: "terra", name: "TERRA", fragmentFunction: "room_terra",
             tasteEnergy: 0, tasteCalm: 0.9, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 0.6, heavy: true, calm: true),
        Room(key: "stokes", name: "NAVIER–STOKES", fragmentFunction: "room_stokes",
             tasteEnergy: 0.8, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0,
             tasteBass: 0.6, tasteEntropy: 0.5),
        Room(key: "orbitals", name: "ORBITALS", fragmentFunction: "room_orbitals",
             tasteEnergy: 0, tasteCalm: 0.8, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.6, tasteEntropy: -0.3, heavy: true, calm: true),
        Room(key: "dna", name: "DNA", fragmentFunction: "room_dna",
             tasteEnergy: 0, tasteCalm: 0.7, tasteBeat: 0.4, tasteTreble: 0,
             tasteMid: 0.5, heavy: true, calm: true),
    ]

    /// The calm room the reduced-motion door opens into — found by key,
    /// never by index, so reordering the roster cannot break the law.
    static var pulseIndex: Int {
        all.firstIndex(where: { $0.key == "pulse" }) ?? 0
    }
}

/// The auto-director: pure state, ticked by the renderer.
/// It decides WHICH room and WHEN; the renderer owns HOW the change
/// looks (the xform composite is the renderer's business).
struct Director {

    /// The six words the moment collapses into — each biases the deal and
    /// scales the dwell. Nested so it cannot collide in the module namespace.
    private enum Mood {
        case adrift, ascend, drive, apex, swarm, dissolve
    }

    private(set) var currentIndex: Int
    /// Auto-deal switch. Off = the director holds still; manual step()
    /// keeps working either way. The renderer wires this to VizSettings.
    var autoOn: Bool = true

    // memory ring of the last five rooms shown, oldest first —
    // the recency tax reads from the newest end
    private var recent: [Int] = []
    private var seen: Set<Int>
    private var dwellRemaining: Double

    // the pending switch: once dwell expires the next room is chosen and
    // queued, then fired on the next boundary (phrase for a mood change,
    // bar otherwise), never later than 4 s
    private var pending: Int? = nil
    private var pendingBig: Bool = false
    private var waited: Double = 0

    // mood bookkeeping — a switch is "big" when the mood has turned since
    // the current room was entered
    private var moodNow: Mood = .drive
    private var moodAtEntry: Mood = .drive
    // the structure's ceiling at the last tick — a held passage dwells longer
    private var ceilNow: Double = 1

    // wrap detection: a phase that drops by most of a cycle just wrapped
    private var prevPhrasePhase: Float = 0
    private var prevBarPhase: Float = 0

    private static let actDwell: [Double] = [1.35, 1.00, 0.62, 0.85, 1.45]

    init() {
        self.init(startAt: 0)
    }

    /// Internal doorway for a chosen opener (Reduce Motion opens in PULSE).
    init(startAt index: Int) {
        let n = Rooms.all.count
        currentIndex = n > 0 ? min(max(index, 0), n - 1) : 0
        seen = [currentIndex]
        dwellRemaining = Director.dealDwell(calm: 0.5)
    }

    /// Advance the clock. `act` is the story act (0…4) the renderer read off
    /// the playhead; `ceil` is the structure's intensity ceiling there (1 when
    /// the song shipped no script). The director uses them for the mood, the
    /// act dwell multiplier, and the held-passage stretch. Returns the NEW
    /// index into Rooms.all when a switch fires (this frame), nil otherwise.
    ///
    /// The wave-1 two-argument form still resolves (act defaults to RISING,
    /// ceil to 1), so the public contract holds; the renderer passes both.
    mutating func tick(dt: Double, frame: Analyzer.Frame, act: Int = 1, ceil: Double = 1) -> Int? {
        guard autoOn, Rooms.all.count > 1 else {
            prevPhrasePhase = frame.phrasePhase
            prevBarPhase = frame.barPhase
            return nil
        }

        let entropy = Director.entropyProxy(frame)
        ceilNow = min(max(ceil, 0), 1)
        moodNow = Director.mood(act: act, energy: frame.energy, entropy: entropy, ceil: ceilNow)

        // boundary detection before we overwrite the previous phase
        let phraseWrapped = frame.phrasePhase < prevPhrasePhase - 0.30
        let barWrapped = frame.barPhase < prevBarPhase - 0.30
        prevPhrasePhase = frame.phrasePhase
        prevBarPhase = frame.barPhase

        // no switch queued yet — count the dwell down
        if pending == nil {
            dwellRemaining -= max(dt, 0)
            guard dwellRemaining <= 0 else { return nil }
            let next = deal(frame: frame, mood: moodNow, entropy: entropy)
            pending = next
            pendingBig = (moodNow != moodAtEntry)
            waited = 0
            // fall through — a boundary already here fires immediately
        }

        // a switch is queued — fire it on the right boundary, or when patience runs out
        waited += max(dt, 0)
        let boundary = pendingBig ? phraseWrapped : barWrapped
        guard boundary || waited >= 4.0, let next = pending else { return nil }

        move(to: next, calm: Double(frame.calm), mood: moodNow, act: act)
        pending = nil
        return next
    }

    /// Manual swipe: force the switch now, resetting the dwell. The person
    /// in the room outranks the director — no boundary gating, no taste math.
    mutating func step(_ delta: Int) {
        let n = Rooms.all.count
        guard n > 0, delta != 0 else { return }
        var next = (currentIndex + delta) % n
        if next < 0 { next += n }
        pending = nil
        move(to: next, calm: 0.5, mood: moodNow, act: 1)
    }

    // MARK: - internals

    private mutating func move(to next: Int, calm: Double, mood: Mood, act: Int) {
        recent.append(currentIndex)
        if recent.count > 5 { recent.removeFirst(recent.count - 5) }
        seen.insert(currentIndex)
        seen.insert(next)
        currentIndex = next
        moodAtEntry = mood

        let base = Director.dealDwell(calm: calm)
        let ai = min(max(act, 0), Director.actDwell.count - 1)
        // the web's `held`: a section the structure has capped stretches the
        // dwell (1.25 at a silent ceiling, 1.0 wide open) — a passage the
        // music is holding back is the last thing a timer should cut up
        let held = 1.25 - 0.25 * ceilNow
        let dwell = base * Director.moodDwellMult(mood) * Director.actDwell[ai] * held
        dwellRemaining = min(max(dwell, 7.0), 90.0)
    }

    /// Dwell 16–46 s. The draw leans toward the long end as the music
    /// calms — a calm room deserves to be lived in, not toured. Mood and
    /// act multipliers are applied by the caller.
    private static func dealDwell(calm: Double) -> Double {
        let c = min(max(calm, 0), 1)
        let u = Double.random(in: 0...1)
        let leaned = pow(u, max(0.35, 1.0 - 0.65 * c))
        return 16.0 + 30.0 * leaned
    }

    private static func moodDwellMult(_ mood: Mood) -> Double {
        switch mood {
        case .adrift:   return 1.45
        case .ascend:   return 1.00
        case .drive:    return 0.90
        case .apex:     return 0.62
        case .swarm:    return 0.75
        case .dissolve: return 1.30
        }
    }

    /// A cheap stand-in for spectral entropy: treble energy plus onset churn.
    /// The analyzer frame carries no entropy field, so the moment's "busy-ness"
    /// is read from the high band and the beat envelope.
    private static func entropyProxy(_ frame: Analyzer.Frame) -> Float {
        return min(max(0.55 * frame.treble + 0.60 * frame.onsetEnv, 0), 1)
    }

    /// The moment collapsed into one word — the web's roomMood. Precedence is
    /// the law: apex (only when the structure's ceiling has EARNED it, > 0.55),
    /// dissolve, swarm, adrift, ascend, else drive.
    private static func mood(act: Int, energy: Float, entropy: Float, ceil: Double = 1) -> Mood {
        let e = Double(energy)
        if act == 2 && ceil > 0.55 && e > 0.45 { return .apex }
        if act == 4 || (act == 3 && e < 0.42) { return .dissolve }
        if Double(entropy) > 0.55 && e > 0.35 { return .swarm }
        if act == 0 || e < 0.30 { return .adrift }
        if act == 1 && e > 0.48 { return .ascend }
        return .drive
    }

    /// The mood's appetite over a room — heavy rooms rise at the apex, calm
    /// rooms adrift; swarm favours the percussive, ascend the energetic.
    private static func moodBias(_ room: Room, _ mood: Mood) -> Double {
        switch mood {
        case .apex:
            return room.heavy ? 1.7 : (room.calm ? 0.5 : 1.2)
        case .adrift:
            return room.calm ? 1.7 : (room.heavy ? 0.5 : 0.8)
        case .dissolve:
            return room.calm ? 1.4 : 0.8
        case .swarm:
            return 1.0 + 0.5 * Double(max(room.tasteBeat, room.tasteTreble))
        case .ascend:
            return 1.0 + 0.4 * Double(max(room.tasteEnergy, 0))
        case .drive:
            return 1.0
        }
    }

    /// The taste deal: appetite dot the moment, mood bias, recency tax,
    /// novelty lift, the current room excluded, then one weighted draw.
    private func deal(frame: Analyzer.Frame, mood: Mood, entropy: Float) -> Int {
        let rooms = Rooms.all
        var weights = [Double](repeating: 0, count: rooms.count)
        var total = 0.0
        for (i, room) in rooms.enumerated() {
            let w = score(room: room, index: i, frame: frame, mood: mood, entropy: entropy)
            weights[i] = w
            total += w
        }
        guard total > 0 else { return (currentIndex + 1) % rooms.count }
        var draw = Double.random(in: 0..<total)
        for (i, w) in weights.enumerated() {
            draw -= w
            if draw < 0 { return i }
        }
        // floating-point residue: hand back the last room that held weight
        return weights.lastIndex(where: { $0 > 0 }) ?? ((currentIndex + 1) % rooms.count)
    }

    private func score(room: Room, index: Int, frame: Analyzer.Frame,
                       mood: Mood, entropy: Float) -> Double {
        // the current room never re-deals itself
        if index == currentIndex { return 0 }

        // a negative weight is an appetite for ABSENCE — it earns its full
        // points when the feature is silent
        func term(_ w: Float, _ v: Float) -> Double {
            let value = Double(min(max(v, 0), 1))
            return w >= 0 ? Double(w) * value : Double(-w) * (1 - value)
        }

        var s = 1.0
        s += term(room.tasteEnergy, frame.energy)
        s += term(room.tasteCalm, frame.calm)
        s += term(room.tasteBeat, frame.onsetEnv)
        s += term(room.tasteTreble, frame.treble)
        s += term(room.tasteMid, frame.mid)
        s += term(room.tasteBass, frame.bass)
        s += term(room.tasteEntropy, entropy)
        s = max(s, 0.02)                    // taste never zeroes a room outright

        // the mood's appetite for this kind of room
        s *= max(Director.moodBias(room, mood), 0.02)

        // recency tax: ring of the last five, 0.10 (just left) … 1.0 (aged out)
        if let pos = recent.lastIndex(of: index) {
            let fromNewest = Double(recent.count - 1 - pos)
            s *= 0.10 + 0.90 * (fromNewest / 5.0)
        }

        // never-shown rooms get the novelty lift — the house gets toured
        if !seen.contains(index) { s *= 1.55 }

        return s
    }
}

/// The visual settings the shelves write and the renderer reads. Main-actor,
/// ObservableObject (no @Observable macro, by decree). The renderer reads
/// `.shared` each frame on the main actor — no snapshot, no crash.
@MainActor final class VizSettings: ObservableObject {
    static let shared = VizSettings()
    @Published var autoRooms: Bool = true {     // the director deals on its own
        didSet { UserDefaults.standard.set(autoRooms, forKey: Self.autoRoomsKey) }
    }
    @Published var calm: Bool = false {         // Reduce flashing — forces the calm tier
        didSet { UserDefaults.standard.set(calm, forKey: Self.calmKey) }
    }
    @Published var lensAuto: Bool = true {      // the artistic glass at the peaks
        didSet { UserDefaults.standard.set(lensAuto, forKey: Self.lensKey) }
    }

    private static let autoRoomsKey = "aethra.viz.autoRooms"
    private static let calmKey = "aethra.viz.calm"
    private static let lensKey = "aethra.viz.lensAuto"

    /// Remembered like the mixing preferences: tiny and non-secret, so
    /// UserDefaults is the right size. A first launch inherits the system's
    /// Reduce Motion for calm; after that the listener's choice stands.
    private init() {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: Self.autoRoomsKey) != nil {
            autoRooms = defaults.bool(forKey: Self.autoRoomsKey)
        }
        if defaults.object(forKey: Self.calmKey) != nil {
            calm = defaults.bool(forKey: Self.calmKey)
        } else {
            calm = UIAccessibility.isReduceMotionEnabled
        }
        if defaults.object(forKey: Self.lensKey) != nil {
            lensAuto = defaults.bool(forKey: Self.lensKey)
        }
    }
}

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
   the eased `act` uniform. Dwell is the web's ROOM_DWELL: 24–64 s by
   energy, scaled by mood and act, floored at 14 s and rounded to whole
   phrases (never fewer than two); and EVERY automatic change — the
   dwell, a page of the script turning, a drop, the kit's return, a
   surge, the idle gallery — answers one pace gate (the web's PACE):
   a minimum gap in bars since the last change, by act. A room that
   stays a while DEVELOPS in place (the renderer eases its dice to a
   fresh face at 45 % and 80 % of the want). A switch only ever LANDS ON A
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

        // The bench (Shaders19): Maxwell's pinching dipole loops and the
        // spectrum's honest sliver, Fedorov's complete census of the plane,
        // and the soap films' least-area answers — ninety-eight, both stages.
        Room(key: "maxwell", name: "MAXWELL", fragmentFunction: "room_maxwell",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0.6,
             tasteMid: 0.8),
        Room(key: "seventeen", name: "THE SEVENTEEN", fragmentFunction: "room_seventeen",
             tasteEnergy: 0, tasteCalm: 0.9, tasteBeat: 0.4, tasteTreble: 0,
             tasteEntropy: -0.5, calm: true),
        Room(key: "minimal", name: "MINIMAL", fragmentFunction: "room_minimal",
             tasteEnergy: 0, tasteCalm: 1.0, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: -0.3, heavy: true, calm: true),

        // Spacetime and the gas (Shaders20): the light cone and the honest
        // twins, and the only law with a direction — entropy measured from
        // the real occupancy, in the shader itself — one hundred, both stages.
        Room(key: "minkowski", name: "MINKOWSKI", fragmentFunction: "room_minkowski",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.6, tasteTreble: 0,
             tasteMid: 0.6, tasteEntropy: -0.2),
        Room(key: "boltzmann", name: "BOLTZMANN", fragmentFunction: "room_boltzmann",
             tasteEnergy: 0.7, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0.4,
             tasteEntropy: 0.6, heavy: true),

        // The perfect deck (Shaders21): a perfect shuffle is no chance at all —
        // j -> 2j mod (N - 1) — so eight of them bring 52 cards home. The weave,
        // Elmsley's binary trick, and the powers of two walking the orbit.
        Room(key: "shuffle", name: "SHUFFLE", fragmentFunction: "room_shuffle",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.8, tasteTreble: 0,
             tasteMid: 0.5, tasteEntropy: -0.4, heavy: true),

        // The twisted bottle (Shaders22): a stellarator twists its field with the
        // shape of its coils alone. The flux surface and its closed field lines,
        // the Poincaré section with its island chains, and the l = 2 heliotron.
        Room(key: "stellarator", name: "STELLARATOR", fragmentFunction: "room_stellarator",
             tasteEnergy: 0.6, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.3, tasteBass: 0.4, tasteEntropy: -0.3, heavy: true),

        // Sacred geometry, magnetised (Shaders23): magnets on the Flower of Life,
        // the Halbach ring, currents on Metatron's cube — the field lines exact,
        // the nulls lit where the geometries reconnect.
        Room(key: "flux", name: "FLUX", fragmentFunction: "room_flux",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.5, tasteTreble: 0,
             tasteBass: 0.4, tasteEntropy: -0.3),

        // The elastic collision, in slow motion (Shaders24): the table, the
        // lanes (equal masses exchange velocities — triangle waves, sorted) and
        // Newton's cradle. The web's table is a live simulation; the TV's is
        // retold closed-form: exact off the walls, lit where balls meet.
        Room(key: "carom", name: "CAROM", fragmentFunction: "room_carom",
             tasteEnergy: 0.3, tasteCalm: 0.4, tasteBeat: 0.6, tasteTreble: 0,
             tasteEntropy: -0.2),

        // The ball pit (Shaders25): balls poured in, bounced off the walls and
        // off nothing else, until the box is full — the hopper, the fountain,
        // the cannon. Every ball an exact projectile (the geometric ladder of
        // bounces, closed form), the pile a hex lattice, the floor opening at
        // the brim. Forty projectiles a pixel: heavy, so 1080p.
        Room(key: "ballpit", name: "BALLPIT", fragmentFunction: "room_ballpit",
             tasteEnergy: 0.6, tasteCalm: 0, tasteBeat: 0.5, tasteTreble: 0,
             tasteBass: 0.3, tasteEntropy: 0.2, heavy: true),

        // Architecture against gravity (Shaders26): the arch with its line of
        // thrust and its hinges, the corbel by the harmonic law, the dome under
        // membrane theory with its 51.8° ring, its cracks and its buttresses.
        // Every phase a function of one clock: built, loaded, failed, rebuilt.
        Room(key: "masonry", name: "MASONRY", fragmentFunction: "room_masonry",
             tasteEnergy: 0, tasteCalm: 0.3, tasteBeat: 0.3, tasteTreble: 0,
             tasteBass: 0.5, tasteEntropy: -0.4, heavy: true),

        // The three cones (the wake room): the Mach cone from circles emitted along the
        // source's real path, the Kelvin wake's 19.47° in closed form (two stationary
        // phases), and the Cherenkov horn of a slowing particle with its lit wall.
        Room(key: "wake", name: "WAKE", fragmentFunction: "room_wake",
             tasteEnergy: 0.6, tasteCalm: 0, tasteBeat: 0.4, tasteTreble: 0.2,
             tasteEntropy: -0.1, heavy: true),

        // The race of curves (Shaders28): the brachistochrone beating the ramp, the
        // circle and a dive (the cycloid exact, the others marched), the tautochrone's
        // seven heights arriving together, and Huygens' cycloidal-cheek pendulum.
        Room(key: "brachisto", name: "BRACHISTOCHRONE", fragmentFunction: "room_brachisto",
             tasteEnergy: 0.2, tasteCalm: 0.5, tasteBeat: 0.4, tasteTreble: 0,
             tasteEntropy: -0.4),

        // The sky's optics (Shaders29): Descartes' and Airy's rainbow with its
        // supernumeraries, the ice halos with sundogs and the circumzenithal arc in a
        // stereographic sky, and the diffraction corona — all in spectral colour from the
        // same CIE observer the web uses. Sixteen wavelengths a pixel: heavy.
        Room(key: "iris", name: "IRIS", fragmentFunction: "room_iris",
             tasteEnergy: 0.1, tasteCalm: 0.7, tasteBeat: 0, tasteTreble: 0.4,
             tasteEntropy: -0.3, heavy: true, calm: true),

        // Lift, made visible (Shaders30): the Joukowski airfoil with Kutta's
        // circulation, pressure and true time-of-flight smoke pulses; the Magnus
        // cylinder; and the conformal map morphing circle into wing. The pulses
        // integrate each pixel's streamline backward: heavy.
        Room(key: "kutta", name: "KUTTA", fragmentFunction: "room_kutta",
             tasteEnergy: 0.4, tasteCalm: 0.3, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.4, tasteEntropy: -0.3, heavy: true),

        // The northern lights (Shaders31): auroral sheets ray-marched through
        // the upper atmosphere with true O 557.7 / O 630.0 / N2+ 427.8 colours, the
        // oval from space, and the dipole mirror with its gyrophase integrated per
        // pixel. Heavy: a 41-sample march with three sheets.
        Room(key: "aurora", name: "AURORA", fragmentFunction: "room_aurora",
             tasteEnergy: 0.3, tasteCalm: 0.5, tasteBeat: 0, tasteTreble: 0.3,
             tasteEntropy: 0.1, heavy: true, calm: true),

        // The ear, listening (Shaders32): the music's spectrum as travelling
        // waves on the basilar membrane by Greenwood's place map — the spiral, the
        // unrolled membrane with its click chirp, the hair cells, the piano on the
        // membrane and the critical bands. Heavy: 24 bands per sample.
        Room(key: "cochlea", name: "COCHLEA", fragmentFunction: "room_cochlea",
             tasteEnergy: 0.3, tasteCalm: 0.2, tasteBeat: 0, tasteTreble: 0.3,
             tasteMid: 0.3, tasteEntropy: 0.2, heavy: true),

        // The turning frame (Shaders33): a throw on a spinning table in both
        // frames, Foucault's pendulum and its pegs at three latitudes, and the
        // Coriolis force at weather scale — the hurricane, inertial circles, the
        // wind belts. Moderately heavy: polylines and two-phase flow noise.
        Room(key: "coriolis", name: "CORIOLIS", fragmentFunction: "room_coriolis",
             tasteEnergy: 0.2, tasteCalm: 0.4, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.4, heavy: true),

        // How we know the inside of the Earth (Shaders34): rays through a
        // nine-shell Earth by spherical Snell's law (P and S shadow zones emerge on
        // their own), the four wave motions as deformed lattices, and the
        // seismologist's desk. Heavy: twenty rays solved per pixel.
        Room(key: "seismic", name: "SEISMIC", fragmentFunction: "room_seismic",
             tasteEnergy: 0.4, tasteCalm: -0.1, tasteBeat: 0.3, tasteTreble: 0,
             tasteEntropy: 0.1, heavy: true),

        // The pull of the Moon (Shaders35): the equilibrium bulges with spring
        // and neap, the lag and the tidal field; Taylor's Kelvin-wave amphidromes
        // with cotidal and co-range lines; a beach and its four-constituent tide
        // gauge. Light.
        Room(key: "tides", name: "TIDES", fragmentFunction: "room_tides",
             tasteEnergy: 0.1, tasteCalm: 0.6, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: -0.2, calm: true),

        // The life of vortices (Shaders36): leapfrogging vortex pairs, Thomson
        // polygons, four-vortex chaos and colliding dipoles — Helmholtz's law
        // integrated per pixel — and the drain, its dye carried back along the
        // inflowing spiral. Heavy: up to 128 RK2 steps per pixel.
        Room(key: "vortex", name: "VORTEX", fragmentFunction: "room_vortex",
             tasteEnergy: 0.4, tasteCalm: 0.2, tasteBeat: 0, tasteTreble: 0,
             tasteMid: 0.3, tasteEntropy: 0.2, heavy: true),

        // Why water falls in drops (Shaders37): Rayleigh's instability — a falling
        // jet solved in closed form to its drops and satellites, the growth curve and
        // the selection of 9.02 radii, dew on a spider's thread, beading fibres and
        // a dripping tap. Moderately heavy.
        Room(key: "plateau", name: "PLATEAU", fragmentFunction: "room_plateau",
             tasteEnergy: 0.2, tasteCalm: 0.4, tasteBeat: 0, tasteTreble: 0.3,
             heavy: true),

        // The tick (Shaders38): the anchor and deadbeat escapements with their
        // pendulum, a long-case clock, a skeleton clock's going train, planetary
        // gears and a Geneva drive, a watch balance with a breathing hairspring,
        // the Swiss lever and a tourbillon. Moderate.
        Room(key: "escapement", name: "ESCAPEMENT", fragmentFunction: "room_escapement",
             tasteEnergy: 0, tasteCalm: 0.2, tasteBeat: 0.5, tasteTreble: 0,
             tasteMid: 0.3, tasteEntropy: -0.4),

        // The expanding universe (Shaders39): Friedmann's equation integrated per
        // pixel — galaxies receding by Hubble's law and reddened by their true
        // redshift, the scale factor of three universes, and our past light cone's
        // teardrop with the Hubble sphere and the last scattering. Heavy.
        Room(key: "hubble", name: "HUBBLE", fragmentFunction: "room_hubble",
             tasteEnergy: 0.2, tasteCalm: 0.5, tasteBeat: 0, tasteTreble: 0,
             heavy: true, calm: true),

        // ---- fractal wave 2: NAVE, PLOTTER, SPECTRAL (Shaders40-42) ----

        // NAVE (Shaders40): a slow flight down the inside of a pseudo-Kleinian
        // limit set (Knighty after Theli-at) — pierced shells or hanging filigree,
        // the straight aisle or the turning crossings, lit by a lantern in hand, a
        // lantern carried ahead, or votive light in every hollow; the beat flares
        // the light, the bass carries it. Heavy.
        Room(key: "nave", name: "NAVE", fragmentFunction: "room_nave",
             tasteEnergy: 0.1, tasteCalm: 0.6, tasteBeat: 0.2, tasteTreble: 0,
             tasteBass: 0.4, tasteEntropy: -0.3, heavy: true),

        // PLOTTER (Shaders41): a sphereflake drawn as a pen plotter would draw it,
        // thin chord-coloured lines on the void with every hidden line removed —
        // section planes, a light-swollen hatch, isolines about each bead's
        // sockets, or the outline pen alone. Heavy, as NAVE and FRACTAL are: a
        // 96-step march over a 7-level IFS, drawn at the 1080-line cap its pens
        // are tuned at.
        Room(key: "plotter", name: "PLOTTER", fragmentFunction: "room_plotter",
             tasteEnergy: 0.2, tasteCalm: 0.2, tasteBeat: 0, tasteTreble: 0.5,
             tasteMid: 0.3, tasteEntropy: -0.3, heavy: true),

        // SPECTRAL (Shaders42): rings threaded on rings, Knighty's distance-estimated
        // IFS from a torus, seven scales deep — each scale's thickness one slice of
        // the 64 log bands (sub-bass the great ring, the air the finest wire), the
        // beat a lamp falling down the scales. Raymarched: heavy.
        Room(key: "spectral", name: "SPECTRAL", fragmentFunction: "room_spectral",
             tasteEnergy: 0.3, tasteCalm: 0, tasteBeat: 0.2, tasteTreble: 0.5,
             tasteMid: 0.3, tasteBass: 0.4, tasteEntropy: -0.1, heavy: true),

        // ---- the fluid wave ----

        // FLUID (Shaders43): the Navier–Stokes equations, retold without a grid —
        // a divergence-free flow in closed form, three dancers' ink walked back
        // along it. Heavy: twenty-four steps of history per pixel.
        Room(key: "fluid", name: "FLUID", fragmentFunction: "room_fluid",
             tasteEnergy: 0.6, tasteCalm: -0.2, tasteBeat: 0.5, tasteTreble: 0,
             tasteBass: 0.4, tasteEntropy: 0.3, heavy: true),

        // ---- the stems wave ----

        // QUARTET (Shaders44): the band, seen — four strands, one per Demucs
        // player, flowing through now, the coming three seconds ghosted ahead
        // from the score. Reads the lane texture (texture(3)) the renderer
        // samples from the stems and the drum chart every frame.
        Room(key: "quartet", name: "QUARTET", fragmentFunction: "room_quartet",
             tasteEnergy: 0.2, tasteCalm: 0, tasteBeat: 0.5, tasteTreble: 0,
             tasteMid: 0.4, tasteBass: 0.4, tasteEntropy: -0.2, heavy: false),
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
    private var dwellWant: Double                // seconds this room was dealt (roomDwellBars)

    // the pending switch: once dwell expires the next room is chosen and
    // queued, then fired on the next boundary (phrase for a mood change,
    // bar otherwise), never later than 4 s
    private var pending: Int? = nil
    private var pendingBig: Bool = false
    private var waited: Double = 0
    // seconds in the current room — the kit's return may cut only a room
    // that has had its say (the web SEGUE's STEM_CUT_DWELL)…
    private var sinceEntry: Double = 0
    static let stemCutDwell: Double = 24
    // …and only after a real absence: a breakdown, not a fill (STEM_CUT.away)
    static let stemCutAway: Double = 6.0
    // seconds since the last room change, whoever asked — the pace gate's
    // clock (the renderer reads it to pace the lens, a minor change)
    private(set) var sinceChange: Double = 0
    // the queued change's reason — the gate answers each reason differently
    private var pendingKind: PaceKind = .dwell
    // the script's page at the last tick, for the boundary classifier — and
    // whose script: a new track's first page is not a turn
    private var lastSection: Int = -1
    private var lastTrack: String? = nil
    // the web's director.phase == 'peak': the surge fires on the way IN
    private var peakNow: Bool = false
    // the room's second act (DEVELOP): steps fired, the step owed, how long
    // it has waited for a phrase line, and the step handed to the renderer
    private var developed: Int = 0
    private var developPend: (step: Int, ease: Double)? = nil
    private var developWait: Double = 0
    private var developOut: (step: Int, ease: Double)? = nil
    /// Whether the last change the director made was a big one (a page turn,
    /// a drop, the kit's return) — the renderer's segueStyle reads it.
    private(set) var lastChangeBig: Bool = false

    // mood bookkeeping — a switch is "big" when the mood has turned since
    // the current room was entered
    private var moodNow: Mood = .drive
    private var moodAtEntry: Mood = .drive
    // the structure's ceiling at the last tick — a held passage dwells longer
    private var ceilNow: Double = 1

    /// Rooms whose Metal pipeline failed to build on THIS device's GPU.
    /// The renderer fills this once at setup; the director never deals a
    /// banned room, and a swipe walks straight past one. One broken room
    /// must cost the house one room, never the whole house.
    var banned: Set<Int> = []

    // wrap detection: a phase that drops by most of a cycle just wrapped
    private var prevPhrasePhase: Float = 0
    private var prevBarPhase: Float = 0

    private static let actDwell: [Double] = [1.6, 1.0, 0.8, 0.95, 1.7]

    init() {
        self.init(startAt: 0)
    }

    /// Internal doorway for a chosen opener (Reduce Motion opens in PULSE).
    init(startAt index: Int) {
        let n = Rooms.all.count
        currentIndex = n > 0 ? min(max(index, 0), n - 1) : 0
        seen = [currentIndex]
        dwellWant = Director.roomDwellBars(seconds: Director.roomDwell(mood: .drive, energy: 0.5, ceil: 1, reduced: false),
                                           actDwell: 1, barLen: 2.0)
    }

    /// Advance the clock. `act` is the story act (0…4) the renderer read off
    /// the playhead; `ceil` is the structure's intensity ceiling there (1 when
    /// the song shipped no script). The director uses them for the mood, the
    /// act dwell multiplier, and the held-passage stretch. `barLen` is the bar
    /// in seconds (2.0 without a grid) — every pacing rule is written in bars;
    /// `reduced` is the calm tier (gaps and dwells grow by half); `structure`,
    /// `prog` and `duration` let the script's page turns be classified and a
    /// loud page ahead be seen (`trackId` says whose script, so a new track's
    /// first page is not a turn); `kitAway` is how long the kit was gone before
    /// this landing; `playing` false puts the field in the idle gallery.
    /// Returns the NEW index into Rooms.all when a switch fires (this frame),
    /// nil otherwise.
    ///
    /// The wave-1 two-argument form still resolves (every later argument has
    /// a default), so the public contract holds; the renderer passes them all.
    mutating func tick(dt: Double, frame: Analyzer.Frame, act: Int = 1, ceil: Double = 1,
                       kitReturn: Bool = false, kitAway: Double = 0,
                       band: StemLight.Band = .none, bandConf: Double = 0,
                       barLen: Double = 2.0, reduced: Bool = false,
                       structure: Structure? = nil, prog: Double = 0, duration: Double = 0,
                       trackId: String? = nil, playing: Bool = true) -> Int? {
        let dtClamped = max(dt, 0)
        sinceEntry += dtClamped
        sinceChange += dtClamped
        guard autoOn, Rooms.all.count > 1 else {
            prevPhrasePhase = frame.phrasePhase
            prevBarPhase = frame.barPhase
            pending = nil
            return nil
        }

        let entropy = Director.entropyProxy(frame)
        ceilNow = min(max(ceil, 0), 1)
        moodNow = Director.stemMood(Director.mood(act: act, energy: frame.energy, entropy: entropy, ceil: ceilNow),
                                    band: band, conf: bandConf, ceil: ceilNow)
        let energy = Double(frame.energy)
        let bar = barLen > 0 ? barLen : 2.0

        // boundary detection before we overwrite the previous phase
        let phraseWrapped = frame.phrasePhase < prevPhrasePhase - 0.30
        let barWrapped = frame.barPhase < prevBarPhase - 0.30
        prevPhrasePhase = frame.phrasePhase
        prevBarPhase = frame.barPhase

        // THE SCRIPT: which page we are on, whether it just turned and what
        // kind of turn that was (the web's sectionChangeClass — a drop or a
        // major turn asks for a big change, a minor nudge for a small one that
        // waits its turn, and a new track's first page is not a turn), and
        // whether a loud page is close enough ahead for the surge to stand down
        var boundaryNow = false
        var aheadLoud = false
        if trackId != lastTrack {
            lastTrack = trackId
            lastSection = -1
        }
        if let st = structure, let si = st.sectionIndex(at: prog) {
            if lastSection >= 0, si != lastSection, st.sections.indices.contains(lastSection) {
                switch Director.sectionChangeClass(prev: st.sections[lastSection], next: st.sections[si]) {
                case .drop:
                    boundaryNow = true
                    request(big: true, kind: .drop, frame: frame, entropy: entropy)
                case .major:
                    boundaryNow = true
                    request(big: true, kind: .section, frame: frame, entropy: entropy)
                case .minor:
                    request(big: false, kind: .section, frame: frame, entropy: entropy)
                case .flat:
                    break
                }
            }
            lastSection = si
            if si + 1 < st.sections.count, duration > 0 {
                let next = st.sections[si + 1]
                let inSec = (next.s - prog) * duration
                aheadLoud = next.loud && inSec >= 0 && inSec <= max(2.4, 1.75 * bar)
            }
        } else {
            lastSection = -1
        }

        // THE SURGE: the web's phase flip into 'peak', through the pure rule
        let ratio = Double(frame.eShort) / max(0.0001, Double(frame.eLong))
        let peak = ratio > 1.35
        if peak != peakNow {
            peakNow = peak
            if Director.surgeShouldRequest(auto: true, peak: peak, ratio: ratio, since: sinceChange,
                                           barLen: bar, ceil: ceilNow, aheadLoud: aheadLoud) {
                request(big: false, kind: .surge, frame: frame, entropy: entropy)
            }
        }

        // THE KIT'S RETURN (StemLight): the drums came back after an absence
        // the light saw coming two seconds early — the room changes ON the
        // landing, not a bar after it. Only a room that has had its say, only
        // after a real absence (a breakdown, not a fill), and only through the gate.
        if kitReturn && sinceEntry >= Director.stemCutDwell && kitAway >= Director.stemCutAway
            && Director.paceGate(since: sinceChange, act: act, barLen: bar, kind: .stem, reduced: reduced).ok {
            let next = pending ?? deal(frame: frame, mood: moodNow, entropy: entropy)
            pending = nil
            if next != currentIndex {
                lastChangeBig = true
                move(to: next, mood: moodNow, act: act, energy: energy, barLen: bar, reduced: reduced)
                return next
            }
        }

        // no switch queued yet — is the dwell up? With nothing playing it is
        // the idle gallery's much longer one: paused is not a reason
        if pending == nil {
            let due = playing ? (sinceEntry >= dwellWant) : (sinceEntry >= Director.paceIdleDwell)
            if due {
                request(big: moodNow != moodAtEntry, kind: playing ? .dwell : .idle, frame: frame, entropy: entropy)
            }
        }

        // THE ROOM'S SECOND ACT (developPlan): owed at 45 % and 80 % of the
        // want, handed to the renderer on the next phrase line (or after eight
        // bars of waiting) so the room evolves on the music
        if playing, developPend == nil,
           let dp = Director.developPlan(dwell: sinceEntry, want: dwellWant, barLen: bar, done: developed) {
            developed += 1
            developPend = dp
            developWait = 0
        }
        if let dp = developPend {
            developWait += dtClamped
            if phraseWrapped || developWait >= 8 * bar {
                developOut = dp
                developPend = nil
            }
        }

        // a switch is queued — fire it on the right boundary once the gate is
        // open, or when patience runs out. Patience only counts while the gate
        // is open, so a refused change lands on the first line AFTER it opens.
        guard let next = pending else { return nil }
        let gateOK = Director.paceGate(since: sinceChange, act: act, barLen: bar,
                                       kind: pendingKind, reduced: reduced).ok
        if gateOK { waited += dtClamped }
        let boundary = pendingBig ? (phraseWrapped || barWrapped) : barWrapped
        let maxWait = pendingBig ? 8.0 : 4.0
        guard gateOK, boundaryNow || boundary || waited >= maxWait else { return nil }

        lastChangeBig = pendingBig
        move(to: next, mood: moodNow, act: act, energy: energy, barLen: bar, reduced: reduced)
        pending = nil
        return next
    }

    /// A change is asked for WITH A REASON. The first request deals the room
    /// and starts the wait; a bigger one upgrades the queued change and takes
    /// the bigger reason (a drop's gate is the loosest).
    private mutating func request(big: Bool, kind: PaceKind, frame: Analyzer.Frame, entropy: Float) {
        if pending == nil {
            pending = deal(frame: frame, mood: moodNow, entropy: entropy)
            pendingBig = big
            pendingKind = kind
            waited = 0
        } else if big {
            if !pendingBig || kind == .drop { pendingKind = kind }
            pendingBig = true
        }
    }

    /// The develop step owed to the renderer, handed over once; nil when none
    /// is due. The renderer eases the live room's dice toward a fresh face
    /// over `ease` seconds (τ = ease / 3) — the web's rollEased.
    mutating func takeDevelop() -> (step: Int, ease: Double)? {
        let d = developOut
        developOut = nil
        return d
    }

    /// Manual swipe: force the switch now, resetting the dwell. The person
    /// in the room outranks the director — no boundary gating, no taste math.
    mutating func step(_ delta: Int) {
        let n = Rooms.all.count
        guard n > 0, delta != 0 else { return }
        // walk one door at a time in the swipe's direction, passing straight
        // by any room this device cannot draw
        let dir = delta > 0 ? 1 : -1
        var next = currentIndex
        for _ in 0..<abs(delta) {
            for _ in 0..<n {
                next = (next + dir + n) % n
                if !banned.contains(next) { break }
            }
        }
        pending = nil
        lastChangeBig = false
        move(to: next, mood: moodNow, act: 1, energy: 0.5, barLen: 2.0, reduced: false)
    }

    // MARK: - internals

    private mutating func move(to next: Int, mood: Mood, act: Int, energy: Double, barLen: Double, reduced: Bool) {
        recent.append(currentIndex)
        if recent.count > 5 { recent.removeFirst(recent.count - 5) }
        seen.insert(currentIndex)
        seen.insert(next)
        currentIndex = next
        moodAtEntry = mood
        sinceEntry = 0
        sinceChange = 0                      // every gate counts from here
        developed = 0                        // a new room tells its own story from the start
        developPend = nil
        developWait = 0
        developOut = nil

        // the web's roomDwellBars: ROOM_DWELL by energy, the mood, the held
        // passage (1.25 at a silent ceiling, 1.0 wide open — a passage the
        // music is holding back is the last thing a timer should cut up), the
        // act — rounded to whole phrases and never fewer than two of them
        let ai = min(max(act, 0), Director.actDwell.count - 1)
        let sec = Director.roomDwell(mood: mood, energy: energy, ceil: ceilNow, reduced: reduced)
        dwellWant = Director.roomDwellBars(seconds: sec, actDwell: Director.actDwell[ai], barLen: barLen)
    }

    // MARK: - the pace (the web's PACE / paceGate — one law on both stages)

    /// The minimum gap between ANY two automatic changes, in bars, by act:
    /// a phrase at the calm edges of the arc, half of one rising and turning,
    /// two bars at the apex. The drop may cut, but a drop is one event.
    static let paceMinGapBars: [Double] = [8, 4, 2, 4, 8]
    static let paceMinGapSec: Double = 6
    static let paceHardFloorSec: Double = 3
    static let paceIdleDwell: Double = 90
    static let paceIdleGapSec: Double = 60

    /// Why a change was asked for — the gate answers each reason differently.
    /// The minor kinds (a lens swap, a mixset's planned room) take the act's own gap.
    enum PaceKind { case dwell, section, drop, stem, seam, surge, idle, lens, mixset }

    /// Has enough music gone by since the last change for THIS kind of change?
    /// A classified drop may come two bars after anything; the mixer's seam IS
    /// the boundary and keeps only the hard floor; the idle gallery waits a
    /// minute; the calm tier widens every other gap by half.
    static func paceGate(since: Double, act: Int, barLen: Double, kind: PaceKind, reduced: Bool)
        -> (ok: Bool, gap: Double, wait: Double) {
        let bar = barLen > 0 ? barLen : 2.0
        let ai = act < 0 ? 1 : min(4, act)
        var gap = max(paceMinGapSec, paceMinGapBars[ai] * bar)
        switch kind {
        case .drop: gap = min(gap, 2 * bar)
        case .seam: gap = paceHardFloorSec
        case .idle: gap = paceIdleGapSec
        default: break
        }
        if reduced && kind != .seam { gap *= 1.5 }
        gap = max(paceHardFloorSec, gap)
        let s = max(0, since)
        return (s >= gap, gap, s >= gap ? 0 : gap - s)
    }

    // MARK: - the dwell (the web's ROOM_DWELL / roomDwell / roomDwellBars)

    static let roomDwellMin: Double = 24
    static let roomDwellMax: Double = 64
    static let roomDwellFloor: Double = 14

    /// Dwell in seconds: busy material turns over faster than quiet material,
    /// the mood scales that, a section the structure has capped stretches it,
    /// and the calm tier asks for fewer rooms (× 1.5). Deterministic — the
    /// old random 16–46 s draw is gone, so the two stages pace alike.
    private static func roomDwell(mood: Mood, energy: Double, ceil: Double, reduced: Bool) -> Double {
        let e = min(max(energy, 0), 1)
        let base = roomDwellMax - (roomDwellMax - roomDwellMin) * e
        let held = 1.25 - 0.25 * min(max(ceil, 0), 1)
        let sec = max(roomDwellFloor, base * moodDwellMult(mood) * held)
        return reduced ? sec * 1.5 : sec
    }

    /// …in whole phrases (eight bars), never fewer than two: the shortest
    /// room anyone sees is a verse's worth, even at the apex.
    static func roomDwellBars(seconds: Double, actDwell: Double, barLen: Double) -> Double {
        let sec = seconds * max(0.1, actDwell)
        let phrase = 8 * (barLen > 0 ? barLen : 2.0)
        return max(2 * phrase, (sec / phrase).rounded() * phrase)
    }

    /// The web's MOODS[mood].dwell, value for value.
    private static func moodDwellMult(_ mood: Mood) -> Double {
        switch mood {
        case .adrift:   return 1.50
        case .ascend:   return 0.95
        case .drive:    return 1.00
        case .apex:     return 0.80
        case .swarm:    return 0.90
        case .dissolve: return 1.60
        }
    }

    // MARK: - the script's page turns (the web's SECTION_CHANGE / sectionChangeClass)

    static let sectionMajor: Double = 0.22
    static let sectionDrop: Double = 0.28

    /// What kind of page turn: a rise of more than `sectionDrop` into a loud
    /// page is a DROP; a change of `sectionMajor` either way, or a loud/quiet
    /// flip, is MAJOR; smaller is MINOR; no page at all is FLAT.
    enum SectionChange { case drop, major, minor, flat }

    static func sectionChangeClass(prev: StructureSection?, next: StructureSection?) -> SectionChange {
        guard let prev, let next else { return .flat }
        let rise = next.energy - prev.energy
        if next.loud && rise > sectionDrop { return .drop }
        if abs(rise) >= sectionMajor || prev.loud != next.loud { return .major }
        return .minor
    }

    // MARK: - the surge (the web's SURGE / surgeShouldRequest)

    static let surgeRatio: Double = 1.6
    static let surgeMinPhrases: Double = 2
    static let surgeMinCeil: Double = 0.7

    /// A real surge (eShort / eLong ≥ 1.6) into a peak, in a room that has
    /// had two phrases, under a ceiling the structure lets run hot — and not
    /// when a loud page is already on its way (the boundary owns that moment).
    static func surgeShouldRequest(auto: Bool, peak: Bool, ratio: Double, since: Double,
                                   barLen: Double, ceil: Double, aheadLoud: Bool) -> Bool {
        if !auto || !peak || aheadLoud { return false }
        let bar = barLen > 0 ? barLen : 2.0
        return ratio >= surgeRatio && since >= surgeMinPhrases * 8 * bar && ceil >= surgeMinCeil
    }

    // MARK: - the room's second act (the web's DEVELOP / developPlan)

    static let developAt: [Double] = [0.45, 0.8]
    static let developEaseBars: Double = 2
    static let developLensEveryPhrases: Double = 2

    /// Which develop step is owed, if any: `done` steps have fired; the next
    /// is due once the dwell has reached its fraction of the want. The ease
    /// is two bars.
    static func developPlan(dwell: Double, want: Double, barLen: Double, done: Int) -> (step: Int, ease: Double)? {
        let k = max(0, done)
        guard k < developAt.count else { return nil }
        let t = want > 0 ? dwell / want : 0
        guard t >= developAt[k] else { return nil }
        return (k, developEaseBars * (barLen > 0 ? barLen : 2.0))
    }

    // MARK: - the segue's length (the web's SEGUE_BARS / segueStyle)

    static let segueBarsCut: Double = 0.25
    static let segueBarsMorph: Double = 1.0
    static let segueBarsDissolve: Double = 1.0
    static let segueBarsMelt: Double = 2.0
    static let segueBarsMin: Double = 0.35
    static let segueBarsMax: Double = 8
    static let segueReducedFloor: Double = 1.6

    enum SegueKind { case cut, morph, dissolve }

    /// How long a change takes, in BARS: a quarter-bar cut at a hot apex, a
    /// two-bar melt at the calm edges (or in quiet music), a bar for a section
    /// turn, a bar that quickens with the heat otherwise. A cut is never under
    /// 0.35 s, nothing runs past 8 s, and the calm tier lengthens every blend
    /// by half and floors a cut at 1.6 s.
    static func segueStyle(act: Int, energy: Double, big: Bool, barLen: Double, reduced: Bool)
        -> (kind: SegueKind, dur: Double) {
        let bar = barLen > 0 ? barLen : 2.0
        func bars(_ b: Double) -> Double { max(segueBarsMin, min(segueBarsMax, b * bar)) }
        func slow(_ d: Double) -> Double { reduced ? min(segueBarsMax, max(segueReducedFloor, d * 1.5)) : d }
        if act == 2 && energy > 0.60 {
            return (.cut, reduced ? max(segueReducedFloor, bars(segueBarsCut)) : bars(segueBarsCut))
        }
        if act == 0 || act == 4 || energy < 0.30 { return (.dissolve, slow(bars(segueBarsMelt))) }
        if big { return (.morph, slow(bars(segueBarsMorph))) }
        return (.dissolve, slow(bars(segueBarsDissolve * (1.6 - 0.8 * energy))))
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

    /// THE BAND NAMES THE MOMENT — the web's stemMood, rule for rule. Once
    /// the stems have authority (conf > 0.5) the section refines the mood,
    /// never inventing a peak the structure did not earn.
    private static func stemMood(_ m: Mood, band: StemLight.Band, conf: Double, ceil: Double) -> Mood {
        guard conf > 0.5 else { return m }
        switch band {
        case .hush:   return m == .dissolve ? .dissolve : .adrift
        case .brk:    return m == .apex ? .dissolve : (m == .drive ? .adrift : m)
        case .drop:   return (m == .drive || m == .ascend) && ceil > 0.4 ? .apex : (m == .adrift ? .drive : m)
        case .song:   return m == .adrift ? .drive : m
        case .groove: return m == .adrift ? .drive : m
        case .none:   return m
        }
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
        guard total > 0 else { return nextLiving(after: currentIndex) }
        var draw = Double.random(in: 0..<total)
        for (i, w) in weights.enumerated() {
            draw -= w
            if draw < 0 { return i }
        }
        // floating-point residue: hand back the last room that held weight
        return weights.lastIndex(where: { $0 > 0 }) ?? nextLiving(after: currentIndex)
    }

    /// The nearest room past `i` this device can actually draw.
    private func nextLiving(after i: Int) -> Int {
        let n = Rooms.all.count
        guard n > 0 else { return 0 }
        for step in 1...n {
            let j = (i + step) % n
            if !banned.contains(j) { return j }
        }
        return (i + 1) % n
    }

    private func score(room: Room, index: Int, frame: Analyzer.Frame,
                       mood: Mood, entropy: Float) -> Double {
        // the current room never re-deals itself, and a room this device's
        // GPU refused is never dealt at all
        if index == currentIndex { return 0 }
        if banned.contains(index) { return 0 }

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

# collage.py: "the sound of AI Estonia", a sound collage built only from what
# research/music-drift already generated (vocal-stripped beds, generated nature
# sounds, a few sung phrases). Research only, local, not published.
#
# Rerun (from anywhere; CPU only, one job at a time, takes ~2 min):
#
#   # once: the venv (exact pins)
#   uv venv ~/visualia-local/collage/.venv --python 3.12
#   uv pip install --python ~/visualia-local/collage/.venv/bin/python \
#     librosa==0.11.0 soundfile==0.13.1 pyloudnorm==0.1.1 scipy==1.18.1 numpy==2.5.5 numba==0.68.1
#   # once: vocals for the sung fragments (Demucs, CPU; ~20 s per clip)
#   cd research/music-drift/out && for f in el-regi-anneke.mp3 el-regi-tohi.mp3 el-regi-velleke.mp3 \
#       finale/fin-regilaul-arc.mp3 national/nat-sind-surmani.mp3; do
#     ~/visualia-local/demucs/.venv/bin/python -m demucs --two-stems=vocals -n htdemucs -d cpu --mp3 \
#       -o ~/visualia-local/collage/sep $f; done
#   # once: word times for cutting the phrases (faster-whisper==1.2.1 in the same venv)
#   cd ~/visualia-local/collage && .venv/bin/python words.py el-regi-tohi el-regi-anneke fin-regilaul-arc nat-sind-surmani
#   # the collage (needs Homebrew rubberband 4.x and ffmpeg on PATH)
#   ~/visualia-local/collage/.venv/bin/python research/music-drift/collage.py [--analyse] [--v2 | --v3]
#
# --analyse re-measures tempo and key of every non-empty bed into
# out/collage/analysis.json (otherwise the cached file is used).
# Writes out/collage/ai-estonia-collage.{wav,mp3} and collage.json; with --v2,
# ai-estonia-collage-2.{wav,mp3} and collage-2.json (v2: nature first, the v1 1:50 style throughout);
# with --v3, ai-estonia-collage-3.* and collage-3.json (v3: v2's second part grown, no harp, no Pärt).
# Intermediate stretched audio is cached in ~/visualia-local/collage/cache.

import json, subprocess, sys, hashlib, pathlib
import numpy as np, librosa, soundfile as sf, pyloudnorm as pyln
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'out'
DST = OUT / 'collage'
LOCAL = pathlib.Path.home() / 'visualia-local/collage'
SEP = LOCAL / 'sep/htdemucs'
CACHE = LOCAL / 'cache'
SR = 44100
BPM = 120.0                       # measured window tempos cluster at 118.8-121.6 (see collage.json)
BEAT = 60 / BPM
BAR = 4 * BEAT
TARGET_LUFS = -16.0
CEIL_DB = -1.0
METER = pyln.Meter(SR)

# ---------------------------------------------------------------- analysis
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']


def key_of(y, sr):
    c = librosa.feature.chroma_cqt(y=y, sr=sr).mean(1)
    cands = []
    for i in range(12):
        cands.append((np.corrcoef(np.roll(MAJ, i), c)[0, 1], f'{NAMES[i]} major'))
        cands.append((np.corrcoef(np.roll(MIN, i), c)[0, 1], f'{NAMES[i]} minor'))
    cands.sort(reverse=True)
    return cands[0][1], round(float(cands[0][0]), 2), c


def tempo_of(y, sr, start_bpm=120):
    """Tempo from the median beat interval (finer than librosa's tempo grid)."""
    _, b = librosa.beat.beat_track(y=y, sr=sr, hop_length=128, units='time', start_bpm=start_bpm)
    return float(60 / np.median(np.diff(b))) if len(b) > 2 else float('nan')


def analyse():
    lv = json.load(open(OUT / 'novocals/levels.json'))
    res = {}
    for k, v in lv.items():
        if v['empty'] or k.startswith(('films/original', 'nature/')):
            continue
        y, sr = librosa.load(OUT / 'novocals' / f'{k}.mp3', sr=22050)
        t, _ = librosa.beat.beat_track(y=y, sr=sr)
        on = librosa.onset.onset_strength(y=y, sr=sr)
        key, r, _ = key_of(y, sr)
        res[k] = dict(dur=round(len(y) / sr, 1), tempo=round(float(np.atleast_1d(t)[0]), 1),
                      key=key, key_r=r,
                      centroid=round(float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())),
                      pulse=round(float(np.std(on) / np.mean(on)), 2))
        print(k, res[k], flush=True)
    DST.mkdir(parents=True, exist_ok=True)
    json.dump(res, open(DST / 'analysis.json', 'w'), indent=1)
    return res


# ---------------------------------------------------------------- dsp helpers
def load(path):
    y, _ = librosa.load(path, sr=SR, mono=False)
    if y.ndim == 1:
        y = np.stack([y, y])
    return y


def rubberband(y, time_ratio, semis, formant=False):
    """Stretch/shift with the rubberband CLI (R3 engine), cached on disk."""
    if abs(time_ratio - 1) < 1e-4 and abs(semis) < 1e-4:
        return y
    CACHE.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha1(y.tobytes() + f'{time_ratio:.5f}{semis:.3f}{formant}'.encode()).hexdigest()[:16]
    dst = CACHE / f'{h}.wav'
    if not dst.exists():
        src = CACHE / f'{h}-in.wav'
        sf.write(src, y.T, SR, subtype='FLOAT')
        cmd = ['rubberband', '-3', '-q', '-t', f'{time_ratio:.6f}', '-p', f'{semis:.3f}']
        if formant:
            cmd.append('-F')
        subprocess.run(cmd + [str(src), str(dst)], check=True)
        src.unlink()
    out, _ = sf.read(dst, always_2d=True)
    return out.T.astype(np.float32)


def biquad(kind, f, q=0.707, gain_db=0.0):
    """RBJ cookbook biquad as second-order sections."""
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * f / SR
    cw, sw = np.cos(w), np.sin(w)
    al = sw / (2 * q)
    if kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'peak':
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    elif kind in ('lowshelf', 'highshelf'):
        s = 2 * np.sqrt(A) * al
        if kind == 'lowshelf':
            b = [A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s)]
            a = [(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s]
        else:
            b = [A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s)]
            a = [(A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s]
    else:
        raise ValueError(kind)
    b, a = np.array(b) / a[0], np.array(a) / a[0]
    return np.concatenate([b, a])[None, :]


def eq(y, bands):
    for band in bands:
        kind, f = band[0], band[1]
        q = band[2] if len(band) > 2 else 0.707
        g = band[3] if len(band) > 3 else 0.0
        y = signal.sosfilt(biquad(kind, f, q, g), y, axis=-1)
    return y.astype(np.float32)


def lufs(y):
    return METER.integrated_loudness(y.T.astype(np.float64))


def norm(y, target):
    l = lufs(y)
    return y * 10 ** ((target - l) / 20) if np.isfinite(l) else y


def fades(n, fi, fo):
    """Equal-power fade in/out envelope of length n samples."""
    env = np.ones(n, np.float32)
    a, b = int(fi * SR), int(fo * SR)
    if a:
        env[:a] = np.sin(np.linspace(0, np.pi / 2, a))
    if b:
        env[-b:] *= np.cos(np.linspace(0, np.pi / 2, b))
    return env


def pan(y, p):
    """p in -1..1, constant power, applied to a stereo signal."""
    l, r = np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)
    return y * np.array([[l * np.sqrt(2)], [r * np.sqrt(2)]], np.float32)


def reverb_ir(seconds=3.2, seed=7):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)).astype(np.float32) * np.exp(-t * 6.9 / seconds)  # -60 dB at end
    ir = eq(ir, [('hp', 250), ('lp', 6000)])
    ir[:, :int(0.012 * SR)] = 0                                                       # small pre-delay
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


IR = None


def echo_verb(y, delay=1.5 * BEAT, fb=0.5, taps=5, wet=0.45, tail=6.0):
    """Ping-pong echo with darkening repeats, then a long synthetic room."""
    global IR
    if IR is None:
        IR = reverb_ir()
    n = y.shape[1] + int(tail * SR)
    out = np.zeros((2, n), np.float32)
    out[:, :y.shape[1]] += y
    d = int(delay * SR)
    tap = y.mean(0)
    for i in range(1, taps + 1):
        tap = eq(tap[None], [('lp', 5000 / i ** 0.6), ('hp', 200 + 60 * i)])[0] * fb
        ch = i % 2                         # alternate left/right
        s = i * d
        m = min(len(tap), n - s)
        out[ch, s:s + m] += tap[:m]
        out[1 - ch, s:s + m] += 0.35 * tap[:m]
    rv = np.stack([signal.fftconvolve(out[c], IR[c])[:n] for c in range(2)])
    return (out * (1 - wet * 0.5) + rv * wet * 0.5).astype(np.float32)


def limiter(x, ceil_db=CEIL_DB, look=0.005, release=0.08):
    """Lookahead peak limiter on the 4x oversampled peak estimate."""
    ceil = 10 ** (ceil_db / 20)
    up = signal.resample_poly(x, 4, 1, axis=-1)
    pk = np.abs(up).max(0).reshape(-1, 4).max(1)[:x.shape[1]]
    g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    L = max(1, int(look * SR))
    g = minimum_filter1d(g, 2 * L + 1)
    g = uniform_filter1d(g, L)                          # smooth attack (stays below need)
    a = np.exp(-1 / (release * SR))                     # one-pole release
    g = signal.lfilter([1 - a], [1, -a], g - 1) + 1
    g = np.minimum(g, minimum_filter1d(np.minimum(1.0, ceil / np.maximum(pk, 1e-9)), 2 * L + 1))
    return (x * g).astype(np.float32), float(20 * np.log10(g.min()))


# ---------------------------------------------------------------- the score
# Times in seconds on the collage timeline; bed starts snap to the bar grid.
# judge = where gemini-3.8-flash placed the clip WITH its voice (measure.json),
# judge_stripped = where it placed the vocal-stripped bed (judge-novocals.jsonl).
BEDS = [
    # A. still Estonia (F major): the one stripped bed the judge still heard as Estonian
    dict(id='mm-anthem-lyrics', src_start=114.8, length=21.0, at=14.0, fi=3, fo=6, gain=-2, stretch=False,
         eq=[('hp', 60), ('peak', 3000, 1.0, -2)], pan=0.0,
         note='foot-stamping regilaul accompaniment (MiniMax); stamping at ~169 bpm does not sit on 120, so it plays alone with the bells'),
    dict(id='tintinnabuli-1-superior', src_start=4.0, length=40.0, at=24.0, fi=8, fo=10, gain=-9, stretch=False,
         eq=[('hp', 450), ('peak', 2500, 1.2, -3), ('highshelf', 8000, 0.7, -3)], pan=0.35,
         note='tintinnabuli bells (code, not a model), free tempo; high-passed so the stamping keeps the low end; bridges F major to D minor'),
    # B. minor drift (D minor): Mongolia, China
    dict(id='films/mm-named-reliikvia', src_start=80.5, length=46.0, at=38.0, fi=6, fo=8, gain=-3,
         eq=[('hp', 70), ('peak', 2200, 1.0, -3)], pan=-0.15,
         note='morin khuur lead (MiniMax), D minor; dip at 2.2 kHz leaves room for the winds'),
    dict(id='national/nudge-randaja-plan', src_start=40.0, length=34.0, at=54.0, fi=6, fo=8, gain=-6, shift=2,
         eq=[('hp', 320), ('peak', 700, 1.0, -4), ('highshelf', 7000, 0.7, -2)], pan=0.3,
         note='xun and dizi winds (ElevenLabs), C minor shifted +2 to D minor; high-passed, mids dipped under the fiddle'),
    # interlude: jaw harp under nature, alone, so left at its own tempo
    dict(id='mm-regilaul-lyrics', src_start=0.0, length=19.0, at=82.0, fi=4, fo=6, gain=-6, stretch=False,
         eq=[('hp', 90), ('lp', 3500), ('peak', 900, 1.0, -3)], pan=-0.25,
         note='jaw harp and breathing (MiniMax), D minor, ~107 bpm, unstretched; low-passed so it sits under the birds'),
    # C. far away (D major): Turkey, UK, Peru
    dict(id='national/nudge-randaja-prompt', src_start=0.5, length=40.0, at=98.0, fi=6, fo=8, gain=-2,
         eq=[('hp', 80), ('peak', 250, 0.9, -2)], pan=0.1,
         note='ney over strings (ElevenLabs), D major; lead of section C'),
    dict(id='films/room-kevade', src_start=4.0, length=38.0, at=108.0, fi=8, fo=10, gain=-5, stretch=False,
         eq=[('hp', 180), ('peak', 1100, 0.8, -5), ('highshelf', 6000, 0.7, -2)], pan=-0.3,
         note='requiem choir and bells (ElevenLabs), D major, rubato (beat tracker unstable, 121-126), so unstretched; mids carved at 1.1 kHz where the ney sits'),
    dict(id='el-ernesaks-2', src_start=2.0, length=22.0, at=122.0, fi=6, fo=8, gain=-8,
         eq=[('hp', 600), ('peak', 1100, 1.0, -4), ('lowshelf', 900, 0.7, -2)], pan=0.4,
         note='panpipes (ElevenLabs), D major; only the top end, panned right'),
    # D. home (D major): harp under the nature return
    dict(id='finale/fin-mix-anthem-bed-anthem', src_start=13.0, length=24.0, at=142.0, fi=6, fo=10, gain=-6,
         stretch=False, shift=-2, eq=[('hp', 120), ('lp', 7000), ('peak', 1800, 1.0, -2)], pan=0.0,
         note='lever harp (ElevenLabs edit), E major shifted -2 to D major; free tempo (~75), alone by then'),
]

NATURE_SEQ = [  # (file, src offset): generated Estonian soundscapes, 25 s each.
    # birch-ee and meadow-ee are skipped: their first 12-15 s are silent.
    ('bog-ee', 0.0), ('peipsi-ee', 0.0), ('eyebright-ee', 0.0), ('setomaa-ee', 0.0), ('spruce-ee', 0.0),
    ('lighthouse-ee', 0.0), ('klint-ee', 10.0), ('peipsi-ee', 0.0), ('bog-ee', 0.0), ('bog-ee', 3.0),
]
NATURE_XF = 5.0
# nature level automation (s, dB relative to -22 LUFS): up between sections, low under music
NATURE_AUTO = [(0, -2), (16, -2), (24, -12), (32, -12), (35, -6), (40, -6), (46, -13), (80, -13),
               (86, -2), (98, -3), (106, -14), (138, -13), (146, -4), (166, -3), (176, -5), (200, -5)]

# sung phrases: Demucs vocal stems of the generated clips, cut at word times from a
# local faster-whisper pass (~/visualia-local/collage/words.py -> words.json).
# src = source range in seconds; key = the section key the phrase is shifted toward.
VOCALS = [
    dict(id='el-regi-tohi', src=(0.0, 6.5), at=4.0, key='F major', gain=-3, pan=-0.2,
         text='"Tohi siin toresta laulda" (may I sing here)'),
    dict(id='fin-regilaul-arc', src=(3.0, 6.3), at=28.0, key='F major', gain=-7, pan=0.3,
         text='"Tule, tule, tüttar noori" (come, come, young daughter)'),
    dict(id='nat-sind-surmani', src=(9.0, 13.5), at=50.0, key='D minor', gain=-6, pan=0.3,
         text='"mu õitsev Eesti rand" (my blossoming Estonian shore)'),
    dict(id='el-regi-anneke', src=(33.3, 35.8), at=70.0, key='D minor', gain=-6, pan=-0.3,
         text='"tuled ka sina minule?" (will you come to me?)'),
    dict(id='fin-regilaul-arc', src=(22.4, 27.7), at=131.0, key=None, gain=-6, pan=-0.25,
         text='the model sings its own stage direction in English: "the voice is melt into a generic folk ambient bed, no words"'),
    dict(id='el-regi-anneke', src=(40.0, 43.7), at=158.0, key='D major', gain=-3, pan=0.0,
         text='"ööse sina kasvad, päeva kaod" (by night you grow, by day you vanish)'),
]
END = 188.0


# ---------------------------------------------------------------- version 2
# After listening to v1 the user liked it "starting 1:50" and asked to "start with nature" and
# "cut earlier" (from the 1:22 interlude). v2 keeps the v1 Far-away recipe throughout: everything
# in D major; one tempo-locked lead at 120 at a time (ney) or one free-tempo lead alone; rubato
# pads (choir, strings, orchestra) high-passed with a mid cut where the lead sits; a top-end colour
# panned wide; nature low under the music and surfacing between leads; one sung phrase about
# every 30 s with a long echo. It opens like the v1 interlude: nature, then a low jaw harp.
BEDS_2 = [
    dict(id='mm-regilaul-lyrics', src_start=0.0, length=24.0, at=10.0, fi=5, fo=7, gain=-6, stretch=False,
         eq=[('hp', 90), ('lp', 3500), ('peak', 900, 1.0, -3)], pan=-0.25,
         note='jaw harp and breathing (MiniMax), drone on D, ~107 bpm, alone so unstretched; low-passed under the birds'),
    dict(id='films/style-kevade', src_start=0.0, length=40.0, at=28.0, fi=8, fo=8, gain=-6, stretch=False,
         eq=[('hp', 120), ('peak', 1100, 0.8, -3), ('highshelf', 7000, 0.7, -2)], pan=-0.2,
         note='string orchestra (ElevenLabs), D major, rubato pad; mids cut at 1.1 kHz for the ney'),
    dict(id='national/nudge-randaja-prompt', src_start=0.5, length=40.0, at=48.0, fi=8, fo=8, gain=-4,
         eq=[('hp', 80), ('peak', 250, 0.9, -2)], pan=0.1,
         note='ney over strings (ElevenLabs), D major, ~120; lead A'),
    dict(id='el-ernesaks-2', src_start=2.0, length=22.0, at=60.0, fi=6, fo=8, gain=-8,
         eq=[('hp', 600), ('peak', 1100, 1.0, -4), ('lowshelf', 900, 0.7, -2)], pan=0.4,
         note='panpipes (ElevenLabs), D major; only the top end, panned right'),
    dict(id='films/room-kevade', src_start=4.0, length=38.0, at=82.0, fi=8, fo=8, gain=-5, stretch=False,
         eq=[('hp', 180), ('peak', 1100, 0.8, -5), ('highshelf', 6000, 0.7, -2)], pan=-0.3,
         note='requiem choir and bells (ElevenLabs), D major, rubato pad; mids carved at 1.1 kHz'),
    dict(id='national/named-mesipuu', src_start=0.0, length=30.0, at=90.0, fi=6, fo=6, gain=-4, stretch=False,
         eq=[('hp', 100), ('peak', 300, 0.9, -2)], pan=0.15,
         note='Andean harp and quena (ElevenLabs), D major, ~100 bpm; lead B, alone between the two ney passages so unstretched'),
    dict(id='national/nudge-randaja-prompt', src_start=50.0, length=20.0, at=120.0, fi=6, fo=6, gain=-2,
         eq=[('hp', 80), ('peak', 250, 0.9, -2)], pan=0.1,
         note='ney (ElevenLabs), D major, ~120; lead C, a second passage of the same bed'),
    dict(id='el-anthem-1', src_start=0.0, length=24.0, at=126.0, fi=6, fo=8, gain=-10, stretch=False,
         eq=[('hp', 250), ('peak', 1100, 0.8, -5), ('highshelf', 6000, 0.7, -3)], pan=-0.3,
         note='orchestra (ElevenLabs), D major, rubato pad, kept low and high-passed'),
    dict(id='finale/fin-mix-anthem-bed-anthem', src_start=13.0, length=24.0, at=146.0, fi=6, fo=10, gain=-6,
         stretch=False, shift=-2, eq=[('hp', 120), ('lp', 7000), ('peak', 1800, 1.0, -2)], pan=0.0,
         note='lever harp (ElevenLabs edit), E major shifted -2 to D major; free tempo, alone, as in v1'),
]
NATURE_SEQ_2 = [('setomaa-ee', 0.0), ('spruce-ee', 0.0), ('peipsi-ee', 0.0), ('eyebright-ee', 0.0),
                ('lighthouse-ee', 0.0), ('klint-ee', 10.0), ('peipsi-ee', 0.0), ('bog-ee', 0.0),
                ('bog-ee', 3.0), ('bog-ee', 6.0)]
NATURE_AUTO_2 = [(0, -2), (12, -3), (30, -6), (48, -13), (80, -13), (86, -7), (92, -13), (116, -13),
                 (122, -8), (128, -13), (140, -10), (146, -5), (168, -3), (190, -3), (210, -3)]
VOCALS_2 = [
    dict(id='el-regi-tohi', src=(0.0, 6.5), at=38.0, key='D major', gain=-4, pan=-0.2,
         text='"Tohi siin toresta laulda" (may I sing here)'),
    dict(id='fin-regilaul-arc', src=(3.0, 6.3), at=72.0, key='D major', gain=-6, pan=0.3,
         text='"Tule, tule, tüttar noori" (come, come, young daughter)'),
    dict(id='fin-regilaul-arc', src=(22.4, 27.7), at=104.0, key=None, gain=-6, pan=-0.25,
         text='the model sings its own stage direction in English: "the voice is melt into a generic folk ambient bed, no words"'),
    dict(id='el-regi-anneke', src=(33.3, 35.8), at=132.0, key='D major', gain=-6, pan=0.3,
         text='"tuled ka sina minule?" (will you come to me?)'),
    dict(id='el-regi-anneke', src=(40.0, 43.7), at=160.0, key='D major', gain=-3, pan=0.0,
         text='"ööse sina kasvad, päeva kaod" (by night you grow, by day you vanish)'),
]
END_2 = 190.0

# ---------------------------------------------------------------- version 3
# v3: "take only the second part of [v2] and grow it, same style, fade in a start and go", then
# "no harp, no Pärt". So: no lever harp, Andean harp, Paraguayan harp, Swan Lake (harp
# arpeggios), tintinnabuli or other Pärt material. v3 fades straight into the world of the v2
# second part and grows it to ~4.5 min. There is one lead at a time. Between two leads with
# different tempi a free-time pad (choir, Mozart, Verdi, Boccherini) carries the handover, so
# the leads never overlap. Pads are high-passed and cut at 1.1 kHz where the lead sits, the
# panpipes play only the top end, and nature stays low and surfaces between leads. Sung
# phrases are picked so that they fit D major unshifted (or by 1 semitone).
BEDS_3 = [
    # A. fade in on the choir, ney leads, panpipes on top
    dict(id='films/room-kevade', src_start=0.0, length=40.0, at=0.0, fi=14, fo=10, gain=-5, stretch=False,
         eq=[('hp', 180), ('peak', 1100, 0.8, -5), ('highshelf', 6000, 0.7, -2)], pan=-0.3,
         note='choir and bells (ElevenLabs; judge: United Kingdom), D major, rubato pad; the fade-in'),
    dict(id='national/nudge-randaja-prompt', src_start=0.5, length=40.0, at=18.0, fi=8, fo=8, gain=-4,
         eq=[('hp', 80), ('peak', 250, 0.9, -2)], pan=0.1,
         note='ney and oud (ElevenLabs; Turkey), D major, ~120; lead A'),
    dict(id='el-ernesaks-2', src_start=2.0, length=22.0, at=32.0, fi=6, fo=8, gain=-8,
         eq=[('hp', 600), ('peak', 1100, 1.0, -4), ('lowshelf', 900, 0.7, -2)], pan=0.4,
         note='panpipes (ElevenLabs; Peru), D major; only the top end, panned right'),
    # handover pad (free time): ney 120 -> quena
    dict(id='el-anthem-2', src_start=10.0, length=15.0, at=52.0, fi=6, fo=7, gain=-9, stretch=False, shift=-2,
         eq=[('hp', 250), ('peak', 1100, 0.8, -5), ('highshelf', 6000, 0.7, -3)], pan=-0.25,
         note='choir and orchestra (ElevenLabs; Austria), E major shifted -2 to D; the handover pad'),
    # B. quena lead over a low Verdi pad
    dict(id='films/style-nipernaadi', src_start=0.0, length=36.0, at=62.0, fi=6, fo=8, gain=-4, shift=2, stretch=False,
         eq=[('hp', 120), ('peak', 300, 0.9, -2), ('peak', 4000, 1.0, -1)], pan=0.15,
         note='quena over guitar (ElevenLabs; Peru), C major shifted +2 to D, free (~114, not locked: pads carry the handovers); lead B'),
    dict(id='el-anthem-1', src_start=0.0, length=24.0, at=76.0, fi=6, fo=8, gain=-11, stretch=False,
         eq=[('hp', 250), ('peak', 1100, 0.8, -5), ('highshelf', 6000, 0.7, -3)], pan=-0.3,
         note='orchestra (ElevenLabs; Italy), D major, rubato pad, kept low'),
    # C. after a nature breath: solo violin, free time
    dict(id='ORIG:films/named-alpinist-instr', src_start=0.0, length=30.0, at=108.0, fi=6, fo=8, gain=-4,
         stretch=False, eq=[('hp', 90), ('peak', 250, 0.9, -2)], pan=-0.1,
         note='solo violin over shimmering strings (ElevenLabs, instrumental from the start; Finland), D major, free time; lead C'),
    # handover pad: violin -> ney
    dict(id='films/room-kevade', src_start=20.0, length=22.0, at=130.0, fi=6, fo=8, gain=-6, stretch=False,
         eq=[('hp', 180), ('peak', 1100, 0.8, -5), ('highshelf', 6000, 0.7, -2)], pan=0.3,
         note='choir and bells again, a later passage, panned the other way; the handover pad'),
    # D. second ney passage, panpipes return on top, Boccherini strings take the handover
    dict(id='national/nudge-randaja-prompt', src_start=50.0, length=20.0, at=144.0, fi=6, fo=6, gain=-3,
         eq=[('hp', 80), ('peak', 250, 0.9, -2)], pan=0.1,
         note='ney, a later passage of the same bed, ~120; lead D'),
    dict(id='el-ernesaks-2', src_start=10.0, length=14.0, at=150.0, fi=4, fo=6, gain=-9,
         eq=[('hp', 700), ('peak', 1100, 1.0, -4), ('lowshelf', 900, 0.7, -3)], pan=-0.4,
         note='panpipes again, a later passage, now panned left'),
    dict(id='films/mm-room-kevade', src_start=50.0, length=20.0, at=160.0, fi=6, fo=8, gain=-8, stretch=False, shift=2,
         eq=[('hp', 200), ('peak', 1100, 0.8, -4), ('highshelf', 6000, 0.7, -2)], pan=0.25,
         note='string quintet (MiniMax; Italy, Boccherini-like), C major shifted +2 to D, free-time pad'),
    # E. ney returns once more, darker, as the piece closes
    dict(id='national/nudge-randaja-prompt', src_start=20.5, length=20.0, at=176.0, fi=8, fo=10, gain=-5,
         eq=[('hp', 100), ('lp', 5500), ('peak', 250, 0.9, -2)], pan=-0.15,
         note='ney, the second half of lead A again, darker (low-passed) and quieter; lead E'),
    dict(id='films/room-kevade', src_start=2.0, length=40.0, at=184.0, fi=8, fo=18, gain=-7, stretch=False,
         eq=[('hp', 200), ('peak', 1100, 0.8, -5), ('highshelf', 6000, 0.7, -3)], pan=-0.2,
         note='choir and bells, the opening passage again, carrying the last handover'),
    # F. the quena comes back for the close, darker, then nature takes over
    dict(id='films/style-nipernaadi', src_start=18.0, length=22.0, at=204.0, fi=6, fo=12, gain=-6, shift=2, stretch=False,
         eq=[('hp', 140), ('lp', 6000), ('peak', 300, 0.9, -2)], pan=-0.15,
         note='quena, the second half of lead B, low-passed and panned the other way; lead F'),
]
NATURE_SEQ_3 = [('peipsi-ee', 0.0), ('eyebright-ee', 0.0), ('setomaa-ee', 0.0), ('spruce-ee', 0.0),
                ('lighthouse-ee', 0.0), ('klint-ee', 10.0), ('bog-ee', 0.0), ('peipsi-ee', 3.0),
                ('eyebright-ee', 4.0), ('spruce-ee', 2.0), ('setomaa-ee', 3.0), ('bog-ee', 3.0), ('peipsi-ee', 0.0),
                ('bog-ee', 0.0), ('bog-ee', 6.0)]
NATURE_AUTO_3 = [(0, -10), (18, -13), (56, -13), (60, -9), (64, -13), (98, -13), (102, -4), (110, -6),
                 (116, -13), (134, -11), (142, -13), (166, -12), (174, -9), (180, -13), (198, -11),
                 (204, -13), (220, -10), (234, -5), (262, -3), (290, -3)]
VOCALS_3 = [
    dict(id='el-regi-velleke', src=(0.0, 3.6), at=8.0, shift=0, gain=-5, pan=-0.2,
         text='"Üits oli velleke minule" (I had one brother)'),
    dict(id='el-regi-tohi-2', src=(19.0, 21.4), at=40.0, shift=0, gain=-6, pan=0.3,
         text='"sõna võtti ja võsana" (took a word from the thicket)'),
    dict(id='el-regilaul-1', src=(6.2, 9.1), at=72.0, shift=0, gain=-6, pan=-0.3,
         text='"kastes ära hommiku eel" (soaked in dew before morning)'),
    dict(id='fin-regilaul-arc', src=(22.4, 27.7), at=102.0, shift=0, gain=-5, pan=0.0,
         text='the model sings its own stage direction in English: "the voice is melt into a generic folk ambient bed, no words"'),
    dict(id='el-regi-anneke-2', src=(11.2, 14.4), at=134.0, shift=-1, gain=-6, pan=0.3,
         text='"säeb ta sõrme sõrmussida" (she puts rings on her fingers)'),
    dict(id='el-regi-velleke', src=(13.6, 17.2), at=164.0, shift=0, gain=-6, pan=-0.3,
         text='"Seegi sepasse suveni" (a line about a brother taken as a smith)'),
    dict(id='el-regi-tohi-2', src=(30.2, 32.8), at=196.0, shift=0, gain=-7, pan=0.25,
         text='"kubjas kulle külana" (the overseer to the village)'),
    dict(id='el-regi-velleke', src=(33.6, 37.0), at=230.0, shift=0, gain=-4, pan=0.0,
         text='"vallale valljaste päida" (the closing line of the brother song)'),
]
END_3 = 262.0
MASTER_FADE_3 = (20.0, 26.0)

V2 = '--v2' in sys.argv
V3 = '--v3' in sys.argv
MASTER_FADE = (0.5, 6.0)
if V2:
    BEDS, NATURE_SEQ, NATURE_AUTO, VOCALS, END = BEDS_2, NATURE_SEQ_2, NATURE_AUTO_2, VOCALS_2, END_2
if V3:
    BEDS, NATURE_SEQ, NATURE_AUTO, VOCALS, END = BEDS_3, NATURE_SEQ_3, NATURE_AUTO_3, VOCALS_3, END_3
    MASTER_FADE = MASTER_FADE_3
SUFFIX = '-3' if V3 else '-2' if V2 else ''


def judge_maps():
    m = {c['id']: c['country'] for c in json.load(open(OUT / 'measure.json'))['clips']}
    s = {}
    for line in open(OUT / 'judge-novocals.jsonl'):
        j = json.loads(line)
        s[j['id']] = j['country']
    return m, s


def fit_shift(y, key):
    """Pick the shift in -2..+2 semitones whose chroma best fits the section key."""
    tonic = NAMES.index(key.split()[0]); prof = MAJ if 'major' in key else MIN
    c = librosa.feature.chroma_cqt(y=librosa.to_mono(y)[::2], sr=SR // 2).mean(1)
    best = []
    for s in range(-2, 3):
        r = np.corrcoef(np.roll(prof, tonic), np.roll(c, s))[0, 1] - 0.05 * abs(s)
        best.append((r, s))
    best.sort(reverse=True)
    return best[0][1], round(float(best[0][0]), 2)


def main():
    an = analyse() if '--analyse' in sys.argv else json.load(open(DST / 'analysis.json'))
    jv, js = judge_maps()
    n = int((END + 8) * SR)
    mix = np.zeros((2, n), np.float32)
    log = dict(title='the sound of AI Estonia', target=dict(bpm=BPM, key='D major throughout' if V2 or V3 else 'F major opening, D minor, D major',
               lufs=TARGET_LUFS, ceiling_dbtp=CEIL_DB), layers=[])

    def place(y, at, gain_db):
        s = int(at * SR)
        m = min(y.shape[1], n - s)
        mix[:, s:s + m] += y[:, :m] * 10 ** (gain_db / 20)

    # beds
    for b in BEDS:
        orig = b['id'].startswith('ORIG:')         # an instrumental original, no Demucs pass needed
        bid = b['id'][5:] if orig else b['id']
        a = an.get(bid, dict(tempo=None, key=None, key_r=None))
        y = load(OUT / (f'{bid}.mp3' if orig else f'novocals/{bid}.mp3'))
        win = librosa.to_mono(y[:, int(b['src_start'] * SR):int((b['src_start'] + b['length']) * SR)])[::2]
        w_tempo = tempo_of(win, SR // 2)
        w_key, w_kr, _ = key_of(win, SR // 2)
        tempo_to = BPM
        ratio = w_tempo / tempo_to if b.get('stretch', True) else 1.0
        shift = b.get('shift', 0)
        # cut generously around the window, stretch, then find a beat to start on
        s0 = max(0, int((b['src_start'] - 2) * SR))
        seg = y[:, s0:s0 + int((b['length'] / ratio + 4) * SR)]
        seg = rubberband(seg, ratio, shift)
        off = (b['src_start'] - s0 / SR) * ratio
        if b.get('stretch', True):
            _, beats = librosa.beat.beat_track(y=librosa.to_mono(seg)[::2], sr=SR // 2, units='time',
                                               hop_length=128, start_bpm=tempo_to)
            if len(beats):
                off = float(beats[np.argmin(np.abs(beats - off))])
        seg = seg[:, int(off * SR):int(off * SR) + int(b['length'] * SR)]
        seg = eq(seg, b['eq'])
        seg = norm(seg, -20.0)
        seg = pan(seg * fades(seg.shape[1], b['fi'], b['fo']), b['pan'])
        at = round(b['at'] / BAR) * BAR
        place(seg, at, b['gain'])
        log['layers'].append(dict(kind='bed', source=f"out/{bid}.mp3" if orig else f"out/novocals/{bid}.mp3",
            original=f"out/{bid}.mp3", judge_with_voice=jv.get(bid), judge_stripped=None if orig else js.get(bid),
            measured_whole_clip=dict(tempo=a['tempo'], key=a['key'], key_confidence=a['key_r']),
            measured_window=dict(tempo=round(w_tempo, 2), key=w_key, key_confidence=w_kr),
            stretch=dict(from_bpm=round(w_tempo, 2), to_bpm=round(tempo_to, 2) if ratio != 1 else None,
                         time_ratio=round(ratio, 4), percent=round((1 / ratio - 1) * 100, 1)),
            shift_semitones=shift, source_range_s=[round(b['src_start'], 2), round(b['src_start'] + b['length'] / ratio, 2)],
            timeline_s=[round(at, 2), round(at + seg.shape[1] / SR, 2)], fade_in_s=b['fi'], fade_out_s=b['fo'],
            gain_db=b['gain'], pan=b['pan'], eq=[list(e) for e in b['eq']], note=b['note']))

    # nature: one continuous chain with crossfades, level automated
    chain = np.zeros((2, n), np.float32)
    t = 0.0
    nat_log = []
    for name, so in NATURE_SEQ:
        y = load(OUT / 'nature' / f'{name}.mp3')[:, int(so * SR):]
        y = eq(y, [('hp', 40), ('peak', 3500, 0.8, -1.5)])
        y = norm(y, -22.0)
        y = y * fades(y.shape[1], NATURE_XF if t else 2.0, NATURE_XF)
        s = int(t * SR); m = min(y.shape[1], n - s)
        chain[:, s:s + m] += y[:, :m]
        nat_log.append(dict(source=f'out/nature/{name}.mp3', judge=jv.get(f'nature/{name}'),
                            source_range_s=[so, round(so + m / SR, 2)], timeline_s=[round(t, 2), round(t + m / SR, 2)]))
        t += y.shape[1] / SR - NATURE_XF
        if t >= END:
            break
    kt, kv = zip(*NATURE_AUTO)
    autom = 10 ** (np.interp(np.arange(n) / SR, kt, kv) / 20)
    mix += chain * autom
    log['layers'].append(dict(kind='nature', chain=nat_log, crossfade_s=NATURE_XF, level_lufs=-22,
                              eq=[['hp', 40], ['peak', 3500, 0.8, -1.5]],
                              automation_db=[list(k) for k in NATURE_AUTO]))

    # vocal fragments
    for v in VOCALS:
        y = load(SEP / v['id'] / 'vocals.mp3')
        a, b = int(v['src'][0] * SR), min(y.shape[1], int(v['src'][1] * SR))
        seg = y[:, a:b]
        if 'shift' in v:                                                 # v3: chosen by hand
            shift, fit = v['shift'], None
        else:
            shift, fit = fit_shift(seg, v['key']) if v['key'] else (0, None)   # None: half-spoken, leave as is
        seg = rubberband(seg, 1.0, shift, formant=True)
        seg = eq(seg, [('hp', 160), ('peak', 350, 1.0, -2), ('peak', 3000, 1.0, 2), ('lp', 11000)])
        seg = norm(seg * fades(seg.shape[1], 0.04, 0.4), -20.0)
        seg = pan(echo_verb(seg), v['pan'])
        place(seg, v['at'], v['gain'])
        src = {'fin-regilaul-arc': 'finale/fin-regilaul-arc', 'nat-sind-surmani': 'national/nat-sind-surmani'}.get(v['id'], v['id'])
        log['layers'].append(dict(kind='vocal', source=f'out/{src}.mp3', separated='Demucs htdemucs, vocals stem',
            judge_with_voice=jv.get(src), text=v['text'], source_range_s=[round(a / SR, 2), round(b / SR, 2)],
            timeline_s=[v['at'], round(v['at'] + seg.shape[1] / SR, 2)], fit_key=v.get('key', 'D major'), shift_semitones=shift,
            fit_score=fit, formant_preserved=True, gain_db=v['gain'], pan=v['pan'],
            eq=[['hp', 160], ['peak', 350, 1.0, -2], ['peak', 3000, 1.0, 2], ['lp', 11000]],
            fx=dict(echo='ping-pong, dotted quarter (%.3f s), 5 darkening repeats, feedback 0.5' % (1.5 * BEAT),
                    reverb='synthetic 3.2 s room, wet 0.45')))

    # master
    mix = mix[:, :int(END * SR)]
    mix *= fades(mix.shape[1], *MASTER_FADE)
    mix = eq(mix, [('hp', 30)])
    pre = lufs(mix)
    mix = norm(mix, TARGET_LUFS)
    for _ in range(2):                      # limit, then trim back to target
        mix, gr = limiter(mix)
        mix = norm(mix, TARGET_LUFS)
    mix, gr = limiter(mix)
    out_lufs = lufs(mix)
    tp = 20 * np.log10(np.abs(signal.resample_poly(mix, 4, 1, axis=-1)).max())
    DST.mkdir(parents=True, exist_ok=True)
    wav = DST / f'ai-estonia-collage{SUFFIX}.wav'
    sf.write(wav, mix.T, SR, subtype='PCM_24')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '192k',
                    str(DST / f'ai-estonia-collage{SUFFIX}.mp3')], check=True)
    # sanity: key per 12 s window of the master
    windows = []
    for s in np.arange(0, END - 6, 12):
        k, r, _ = key_of(librosa.to_mono(mix[:, int(s * SR):int((s + 12) * SR)])[::2], SR // 2)
        windows.append([float(s), k, r])
    log['master'] = dict(seconds=round(mix.shape[1] / SR, 1), lufs_before=round(pre, 1), lufs=round(out_lufs, 1),
                         true_peak_dbtp=round(float(tp), 2), max_limiter_gr_db=round(gr, 1),
                         key_per_12s=windows)
    json.dump(log, open(DST / f'collage{SUFFIX}.json', 'w'), indent=1, ensure_ascii=False)
    print(json.dumps(log['master'], indent=1))
    for l in log['layers']:
        if l['kind'] != 'nature':
            print(l['kind'], l['source'], l['timeline_s'], 'shift', l['shift_semitones'], l.get('stretch', ''))


if __name__ == '__main__':
    main()

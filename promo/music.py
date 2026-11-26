import numpy as np
import wave

SR = 44100
DUR = 15.0
N = int(SR * DUR)
t = np.arange(N) / SR
mix = np.zeros((N, 2))

BEAT = 60 / 96
BAR = BEAT * 4

def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)

# C  G  Am  F  G  C
chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60], [55, 59, 62], [60, 64, 67]]
roots = [36, 43, 45, 41, 43, 36]

def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    mix[i : i + len(sig), 0] += sig * l
    mix[i : i + len(sig), 1] += sig * r

def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[na : na + nd] = np.linspace(1, s, nd)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e

for bi, ch in enumerate(chords):
    start = bi * BAR
    length = BAR + 0.4
    n = int(length * SR)
    tt = np.arange(n) / SR
    # pad
    pad = np.zeros(n)
    for note in ch:
        f = midi(note)
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            pad += np.sin(2 * np.pi * ff * tt) + 0.3 * np.sin(4 * np.pi * ff * tt) + 0.1 * np.sin(6 * np.pi * ff * tt)
    pad *= env_adsr(n, 0.4, 0.5, 0.8, 0.5) * 0.035
    add(pad, start, -0.2)
    add(pad, start + 0.01, 0.2)
    # bass
    f = midi(roots[bi])
    bass = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)) * env_adsr(n, 0.02, 0.3, 0.7, 0.4) * 0.16
    add(bass, start)
    # arpeggio, eighth notes
    pattern = [0, 1, 2, 1, 2, 3, 2, 1]
    for k, idx in enumerate(pattern):
        if bi == 0 and k < 2:
            continue
        note = ch[idx % 3] + 12 * (1 + idx // 3)
        f = midi(note)
        nn = int(0.9 * SR)
        t2 = np.arange(nn) / SR
        pl = (np.sin(2 * np.pi * f * t2) + 0.35 * np.sin(4 * np.pi * f * t2) * np.exp(-t2 * 8)) * np.exp(-t2 * 5.5)
        pl *= np.minimum(1, t2 / 0.004)
        add(pl, start + k * BEAT / 2, pan=0.35 if k % 2 else -0.35, gain=0.09)

# soft kick + hat from bar 2
for b in range(int(DUR / BEAT)):
    bt = b * BEAT
    if bt < BAR - 0.01 or bt > DUR - 0.8:
        continue
    nn = int(0.35 * SR)
    t2 = np.arange(nn) / SR
    freq = 50 + 70 * np.exp(-t2 * 30)
    kick = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t2 * 10)
    add(kick, bt, gain=0.32)
    nh = int(0.06 * SR)
    hat = np.random.default_rng(b).standard_normal(nh)
    hat = np.diff(hat, prepend=0) * np.exp(-np.arange(nh) / SR * 70)
    add(hat, bt + BEAT / 2, pan=0.3, gain=0.03)

def chime(start, base=84):
    for j, note in enumerate([base, base + 4, base + 7, base + 12]):
        f = midi(note)
        nn = int(1.6 * SR)
        t2 = np.arange(nn) / SR
        c = (np.sin(2 * np.pi * f * t2) + 0.2 * np.sin(2 * np.pi * f * 2.76 * t2)) * np.exp(-t2 * 3)
        add(c, start + j * 0.07, pan=-0.4 + j * 0.27, gain=0.06)

def whoosh(center, length=0.6):
    nn = int(length * SR)
    rng = np.random.default_rng(int(center * 100))
    w = rng.standard_normal(nn)
    # crude band-pass sweep via moving average of varying width
    out = np.zeros(nn)
    acc = np.cumsum(w)
    for i in range(nn):
        k = int(40 - 34 * i / nn)
        out[i] = (acc[i] - acc[max(0, i - k)]) / k
    e = np.sin(np.linspace(0, np.pi, nn)) ** 2
    add(out * e, center - length / 2, gain=0.22)

chime(0.2)
chime(12.65, 79)
for c in (2.6, 5.7, 9.85, 12.6):
    whoosh(c)

# master fades
fade_in = np.minimum(1, t / 0.15)
fade_out = np.clip((DUR - t) / 1.4, 0, 1)
mix *= (fade_in * fade_out)[:, None]
mix /= np.max(np.abs(mix)) / 0.89
data = (mix * 32767).astype(np.int16)
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print('ok')

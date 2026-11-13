"""Twenty original comic electronic mini-tracks, with no third-party recordings.

All tracks last 32 seconds so the shared DJ can schedule and synchronize them.
MP3s load on demand; they are deliberately excluded from the offline shell.
"""
import json
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE, LENGTH = 22050, 32
TRACKS = [
    ('Пара отменена — рейв!', 'Пружинный бас и праздничные пищалки', 140, 'boing'),
    ('SQL на каблуках', 'Диско-фанк для баз данных', 120, 'pluck'),
    ('Казу на пересдаче', 'Утиный солист и ломаный бит', 108, 'kazoo'),
    ('Жаба на самокате', 'Скачущий электросвинг', 150, 'croak'),
    ('Кофе вместо сна', 'Гиперактивный чиптюн', 160, 'chip'),
    ('Принтер орёт', 'Робот-фанк с цифровыми сбоями', 112, 'robot'),
    ('Бас из общаги', 'Тяжёлый бас и смешной свист', 96, 'whistle'),
    ('Танец потерянной флешки', 'Космическое диско', 126, 'bell'),
    ('Техно-картошка', 'Клубный грув с пружинками', 136, 'boing'),
    ('Дедлайн улетел', 'Безумный аркадный забег', 172, 'chip'),
    ('Wi-Fi на дискотеке', 'Глитч-хаус с роботами', 128, 'robot'),
    ('Пельмень-дроп', 'Пружинный хип-хоп', 90, 'croak'),
    ('Ошибка 404: сон', 'Ломаный ночной электробит', 144, 'bell'),
    ('Мяу-семинар', 'Кошачий синтезатор и фанк', 116, 'meow'),
    ('Турбо-тапочки', 'Скоростной пиксельный рейв', 164, 'chip'),
    ('Драм-н-бубен', 'Быстрые барабаны и казу', 176, 'kazoo'),
    ('Качаем зачётку', 'Танцевальный бас и щипки', 124, 'pluck'),
    ('Лифт на шестой', 'Лифт-диско с космическим свистом', 104, 'whistle'),
    ('Синтезатор под партой', 'Ломаный фанк и тайные пищалки', 132, 'robot'),
    ('Последний автобус', 'Весёлый финальный синти-забег', 148, 'meow'),
]


def render(index, title, description, bpm, voice):
    rng = np.random.default_rng(309100 + index)
    data = np.zeros(RATE * LENGTH, dtype=np.float64)
    beat = 60 / bpm

    def add(at, tone):
        start = round(at * RATE)
        count = min(len(tone), len(data) - start)
        if count > 0:
            data[start:start + count] += tone[:count]

    def note(at, midi, duration, volume, kind):
        t = np.arange(round(duration * RATE)) / RATE
        freq = np.full_like(t, 440 * 2 ** ((midi - 69) / 12))
        if kind == 'boing':
            freq *= .55 + 1.9 * np.exp(-t * 18)
        elif kind == 'croak':
            freq *= 1 + .16 * np.sin(2 * np.pi * 21 * t) * np.exp(-t * 6)
        elif kind == 'meow':
            freq *= 1.5 - .8 * np.minimum(1, t / duration)
        elif kind == 'robot':
            freq *= 1 + .1 * np.floor(t * 23) / 3
        else:
            freq *= 1 + .008 * np.sin(2 * np.pi * 7 * t)
        phase = 2 * np.pi * np.cumsum(freq) / RATE
        if kind == 'chip':
            tone = np.tanh(4 * np.sin(phase))
        elif kind in ('kazoo', 'robot', 'croak'):
            tone = np.sin(phase) + .35 * np.sin(3 * phase) + .15 * np.sin(5 * phase)
        elif kind == 'bell':
            tone = np.sin(phase) + .45 * np.sin(2.71 * phase) * np.exp(-t * 9)
        else:
            tone = np.sin(phase) + .15 * np.sin(2 * phase)
        env = np.minimum(1, t / .008) * np.minimum(1, (duration - t) / .03)
        env *= np.exp(-t * (7 if kind in ('bass', 'pluck') else 2))
        add(at, tone * env * volume)

    key = [0, 2, -3, 5, -2][index % 5]
    scale = np.array([0, 2, 3, 5, 7, 10, 12]) if index % 2 else np.array([0, 2, 4, 7, 9, 12, 14])
    motif = rng.choice(scale, 16).tolist()
    for step in range(round(LENGTH / beat * 2)):
        at = step * beat / 2
        bar = step // 8
        root = [0, -3, -5, -2][(bar // 2 + index) % 4]
        # A short breakdown and a new register distinguish sections.
        if 13 <= at < 16 and step % 4:
            continue
        if step % (5 + index % 3) != 3:
            note(at, 67 + key + root + motif[step % 16] + (12 if at >= 24 and index % 2 else 0),
                 beat * (.31 if index % 3 else .65), .115, voice)
        if step % 4 == 2 and index % 2:
            note(at + beat * .17, 79 + key + motif[(step + 5) % 16], beat * .18, .055, 'boing')
    for b in range(int(LENGTH / beat) + 1):
        at = b * beat
        root = [0, -3, -5, -2][(b // 8 + index) % 4]
        note(at, 36 + key + root, beat * .65, .21, 'bass')
        if b % 4 == index % 4:
            for chord in (0, 7, 10 if index % 2 else 12):
                note(at + beat / 4, 48 + key + root + chord, beat * .6, .038, 'pluck')
        if not (13 <= at < 15):
            t = np.arange(round(.22 * RATE)) / RATE
            kick = np.sin(2 * np.pi * (45 * t + 2.8 * (1 - np.exp(-t * 28))))
            if index % 4 != 2 or b % 2 == 0:
                add(at, .36 * kick * np.exp(-t * 24))
            if b % 2:
                t = np.arange(round(.13 * RATE)) / RATE
                add(at, .12 * rng.uniform(-1, 1, len(t)) * np.exp(-t * 33))
            for eighth in (0, .5, .75) if index % 3 == 1 else (0, .5):
                t = np.arange(round(.04 * RATE)) / RATE
                add(at + eighth * beat, .035 * rng.uniform(-1, 1, len(t)) * np.exp(-t * 105))
    # A recognizable rising/falling cartoon fill at the end.
    for j in range(8):
        note(30 + j / 5, 60 + key + (j if index % 2 else 7 - j) * 2, .2, .09, voice)
    fade = round(.055 * RATE)
    data[:fade] *= np.linspace(0, 1, fade)
    data[-fade:] *= np.linspace(1, 0, fade)
    data = np.tanh(data * 1.3)
    pcm = (data / max(.001, np.abs(data).max()) * 26000).astype('<i2')
    out = ROOT / 'assets' / 'club-tracks' / f'{index + 1:02}.mp3'
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'track.wav'
        with wave.open(str(wav), 'wb') as file:
            file.setnchannels(1)
            file.setsampwidth(2)
            file.setframerate(RATE)
            file.writeframes(pcm.tobytes())
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-codec:a', 'libmp3lame',
                        '-b:a', '64k', '-metadata', f'title={title}', '-metadata', 'artist=DJ Политешик', str(out)], check=True)
    return dict(id=index + 1, title=title, description=description, seconds=LENGTH,
                src=f'assets/club-tracks/{index + 1:02}.mp3')


if __name__ == '__main__':
    catalog = [render(i, *track) for i, track in enumerate(TRACKS)]
    (ROOT / 'js/data/club-tracks.js').write_text("'use strict';\nconst CLUB_TRACKS = " + json.dumps(catalog, ensure_ascii=False, indent=2) + ';\n')
    print(f'Generated {len(catalog)} original DJ tracks, {LENGTH} seconds each.')

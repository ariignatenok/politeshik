"""Generate the original playful club loop. Uses no recordings or third-party music."""
import array, math, random, subprocess, tempfile, wave
from pathlib import Path
RATE=22050
BEAT=60/124
LENGTH=32*BEAT
samples=array.array('f',[0.0])*round(RATE*LENGTH)
rng=random.Random(3091)
def note(start,duration,midi,volume,kind='kazoo'):
    base=440*2**((midi-69)/12)
    for i in range(round(duration*RATE)):
        t=i/RATE;j=round(start*RATE)+i
        if j>=len(samples):break
        env=min(1,t/.008)*min(1,(duration-t)/.045)*math.exp(-t*(5 if kind=='bass' else 2))
        freq=base*(1+.012*math.sin(2*math.pi*8*t))
        if kind=='boing':freq=base*(.6+1.6*math.exp(-t*17))
        phase=2*math.pi*freq*t
        tone=math.sin(phase)+.35*math.sin(3*phase)+.12*math.sin(5*phase)
        samples[j]+=volume*env*tone
motif=[72,None,76,79,76,74,72,67,69,None,72,76,74,72,69,67,65,None,69,72,76,72,69,65,67,69,71,74,79,None,74,71]
for i in range(64):
    midi=motif[i%32]
    if midi is not None:note(i*BEAT/2,BEAT*.38,midi,.11)
for beat in range(32):
    root=[48,45,41,43][(beat//4)%4]
    note(beat*BEAT,BEAT*.7,root-12,.15,'bass')
    if beat%4==3:note((beat+.5)*BEAT,BEAT*.4,root+24,.07,'boing')
    for i in range(round(.16*RATE)):
        t=i/RATE;j=round(beat*BEAT*RATE)+i
        if j<len(samples):samples[j]+=.23*math.exp(-t*25)*math.sin(2*math.pi*(47*t+3*(1-math.exp(-t*35))))
    if beat%2:
        for i in range(round(.11*RATE)):
            j=round(beat*BEAT*RATE)+i
            if j<len(samples):samples[j]+=.075*rng.uniform(-1,1)*math.exp(-i/RATE*32)
    for eighth in (0,.5):
        for i in range(round(.035*RATE)):
            j=round((beat+eighth)*BEAT*RATE)+i
            if j<len(samples):samples[j]+=.025*rng.uniform(-1,1)*math.exp(-i/RATE*110)
# Gentle seam and headroom for looping.
peak=max(abs(x) for x in samples)
pcm=array.array('h',(round(26000*x/peak) for x in samples))
output=Path(__file__).resolve().parents[1]/'assets/club-bounce.mp3'
with tempfile.TemporaryDirectory() as tmp:
    wav=Path(tmp)/'club.wav'
    with wave.open(str(wav),'wb') as file:
        file.setnchannels(1);file.setsampwidth(2);file.setframerate(RATE);file.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-codec:a','libmp3lame','-b:a','96k',str(output)],check=True)
print(output.name,output.stat().st_size,'bytes')

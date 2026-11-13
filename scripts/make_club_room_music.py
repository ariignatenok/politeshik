"""Original jazz and cartoon-room loops. No third-party recordings."""
import array, math, random, subprocess, tempfile, wave
from pathlib import Path
RATE=22050
ROOT=Path(__file__).resolve().parents[1]
def render(name,cinema=False):
    beat=60/(92 if cinema else 104);length=64*beat
    data=array.array('f',[0.0])*round(RATE*length);rng=random.Random(7501 if cinema else 7502)
    def note(at,midi,duration,volume,bass=False):
        freq=440*2**((midi-69)/12)
        for i in range(round(duration*RATE)):
            j=round(at*RATE)+i
            if j>=len(data):break
            t=i/RATE;env=min(1,t/.01)*min(1,max(0,(duration-t)/.08))*math.exp(-t*(3 if bass else 2.2))
            phase=2*math.pi*freq*t
            data[j]+=volume*env*(math.sin(phase)+(.18 if bass else .32)*math.sin(2*phase)+.08*math.sin(3*phase))
    chords=[[60,64,67,71],[57,61,64,67],[62,65,69,72],[55,59,62,65],[64,67,71,74],[57,61,64,67],[62,65,69,72],[55,59,62,65]]
    for bar in range(16):
        chord=chords[bar%8]
        for off in ([0,2] if cinema else [.65,2.65]):
            for n in chord:note((bar*4+off)*beat,n,beat*1.4,.028)
        for i in range(4):note((bar*4+i)*beat,chord[i]-24,beat*.85,.12,True)
        melody=[chord[0]+12,chord[2]+12,chord[1]+12,chord[3]+12,chord[2]+12,chord[1]+12]
        for i,n in enumerate(melody):note((bar*4+i*.66)*beat,n,beat*(.8 if cinema else .32),.04 if cinema else .06)
    for b in range(64):
        for off in (0,.66):
            for i in range(round(.075*RATE)):
                j=round((b+off)*beat*RATE)+i
                if j<len(data):data[j]+=(.006 if cinema else .015)*rng.uniform(-1,1)*math.exp(-i/RATE*48)
        if b%2:
            for i in range(round(.1*RATE)):
                j=round(b*beat*RATE)+i
                if j<len(data):data[j]+=.012*rng.uniform(-1,1)*math.exp(-i/RATE*28)
    peak=max(abs(x)for x in data)or 1
    pcm=array.array('h',(round(x/peak*24500)for x in data))
    with tempfile.TemporaryDirectory()as temp:
        path=Path(temp)/'music.wav'
        with wave.open(str(path),'wb')as out:out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE);out.writeframes(pcm.tobytes())
        dest=ROOT/'assets'/name
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(path),'-codec:a','libmp3lame','-b:a','96k',str(dest)],check=True)
        print(name,dest.stat().st_size)
render('club-jazz.mp3')
render('club-cinema.mp3',True)

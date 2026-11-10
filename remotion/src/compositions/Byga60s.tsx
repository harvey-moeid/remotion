import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const C = {
  bg: '#080D19', panel: '#101A2D', blue: '#246BFD', cyan: '#5CE1E6',
  violet: '#8B5CF6', white: '#F7FAFF', muted: '#9AAAC4', green: '#45D6A0',
};

const fadeUp = (frame: number, delay = 0) => {
  const p = spring({frame: frame - delay, fps: 30, config: {damping: 18, stiffness: 110, mass: 0.8}});
  return {opacity: p, transform: `translateY(${(1 - p) * 46}px)`};
};

const Glow: React.FC<{x?: string; y?: string; color?: string; size?: number}> = ({
  x = '50%', y = '50%', color = C.blue, size = 700,
}) => (
  <div style={{
    position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%',
    transform: 'translate(-50%, -50%)', background: color, opacity: 0.18,
    filter: 'blur(110px)', pointerEvents: 'none',
  }} />
);

const Eyebrow: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', gap: 12, color: C.cyan, fontSize: 25, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase'}}>
    <span style={{width: 34, height: 3, background: C.cyan, borderRadius: 9}} />{children}
  </div>
);

const Wordmark = () => (
  <div style={{display: 'flex', alignItems: 'center', gap: 13, fontWeight: 900, letterSpacing: 1.5, color: C.white, fontSize: 27}}>
    <div style={{width: 34, height: 34, borderRadius: 11, background: `linear-gradient(135deg,${C.blue},${C.violet})`, display: 'grid', placeItems: 'center', fontSize: 20}}>✦</div>
    BYGA<span style={{color: C.cyan}}>.AI</span>
  </div>
);

const Phone: React.FC<{mode?: 'chat' | 'ideas' | 'build'; scale?: number}> = ({mode = 'chat', scale = 1}) => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 13) * 7;
  return (
    <div style={{
      width: 390 * scale, height: 740 * scale, borderRadius: 54 * scale,
      padding: 12 * scale, background: 'linear-gradient(145deg,#DDE8FA,#52627C 45%,#101827)',
      boxShadow: '0 45px 100px rgba(0,0,0,.55), 0 0 0 2px rgba(255,255,255,.2)',
      transform: `translateY(${bob}px) rotate(-5deg)`, position: 'relative',
    }}>
      <div style={{width: '100%', height: '100%', borderRadius: 44 * scale, overflow: 'hidden', background: '#07101F', padding: 23 * scale, boxSizing: 'border-box', position: 'relative'}}>
        <div style={{width: 90 * scale, height: 18 * scale, borderRadius: 30, background: '#02050A', position: 'absolute', top: 10 * scale, left: '50%', transform: 'translateX(-50%)'}} />
        <div style={{display: 'flex', justifyContent: 'space-between', color: '#DDE7F8', fontSize: 13 * scale, marginTop: 20 * scale}}>
          <span>9:41</span><span>● ● ●</span>
        </div>
        <div style={{marginTop: 36 * scale, display: 'flex', alignItems: 'center', gap: 10 * scale}}>
          <div style={{width: 34 * scale, height: 34 * scale, borderRadius: 12, background: `linear-gradient(135deg,${C.blue},${C.violet})`, display: 'grid', placeItems: 'center', color: 'white', fontSize: 17 * scale}}>✦</div>
          <div style={{color: 'white', fontSize: 16 * scale, fontWeight: 800}}>{mode === 'build' ? 'BYGA Workspace' : 'AI Assistant'}</div>
          <div style={{marginLeft: 'auto', color: C.cyan, fontSize: 11 * scale}}>● ONLINE</div>
        </div>
        {mode === 'chat' && (
          <div style={{marginTop: 35 * scale, display: 'flex', flexDirection: 'column', gap: 17 * scale}}>
            <div style={{alignSelf: 'flex-end', maxWidth: '88%', padding: 15 * scale, borderRadius: 18 * scale, borderBottomRightRadius: 5, background: C.blue, color: 'white', fontSize: 15 * scale, lineHeight: 1.45}}>Bantu aku bikin ide konten keren cuma dari HP.</div>
            <div style={{alignSelf: 'flex-start', maxWidth: '94%', padding: 15 * scale, borderRadius: 18 * scale, borderBottomLeftRadius: 5, background: '#17243A', color: '#EAF1FF', fontSize: 15 * scale, lineHeight: 1.45}}>Siap! Kita buat konsep, naskah, visual, lalu wujudkan dengan tools AI.</div>
            <div style={{alignSelf: 'flex-end', maxWidth: '88%', padding: 15 * scale, borderRadius: 18 * scale, background: C.blue, color: 'white', fontSize: 15 * scale}}>Buatkan langkah-langkahnya.</div>
            <div style={{alignSelf: 'flex-start', maxWidth: '94%', padding: 15 * scale, borderRadius: 18 * scale, background: '#17243A', color: '#EAF1FF', fontSize: 15 * scale, lineHeight: 1.45}}>1. Tentukan ide<br/>2. Susun prompt<br/>3. Generate dan edit<br/>4. Publikasikan</div>
          </div>
        )}
        {mode === 'ideas' && (
          <div style={{marginTop: 34 * scale, color: 'white'}}>
            <div style={{fontSize: 22 * scale, fontWeight: 900, lineHeight: 1.2}}>Your next big idea</div>
            <div style={{fontSize: 12 * scale, color: C.muted, marginTop: 8 * scale}}>Pilih sesuatu untuk mulai dibuat</div>
            {['Website personal', 'Konten video AI', 'Desain brand', 'Ide aplikasi'].map((item, i) => (
              <div key={item} style={{marginTop: 17 * scale, border: '1px solid #263B5D', borderRadius: 15 * scale, padding: 15 * scale, display: 'flex', alignItems: 'center', gap: 12 * scale, background: '#111E33'}}>
                <div style={{width: 31 * scale, height: 31 * scale, borderRadius: 10, background: i % 2 ? '#33265B' : '#173B6C', display: 'grid', placeItems: 'center', color: C.cyan, fontSize: 15 * scale}}>{['▦', '▶', '✧', '⌘'][i]}</div>
                <span style={{fontSize: 14 * scale, fontWeight: 700}}>{item}</span><span style={{marginLeft: 'auto', color: C.cyan}}>›</span>
              </div>
            ))}
          </div>
        )}
        {mode === 'build' && (
          <div style={{marginTop: 34 * scale, color: 'white'}}>
            <div style={{fontSize: 20 * scale, fontWeight: 900}}>Project preview</div>
            <div style={{marginTop: 18 * scale, height: 190 * scale, borderRadius: 17 * scale, background: 'linear-gradient(135deg,#123B78,#5C42A8)', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 18 * scale}}>
              <div><div style={{fontSize: 27 * scale, fontWeight: 900}}>MAKE IT<br/>HAPPEN.</div><div style={{fontSize: 10 * scale, marginTop: 12 * scale, color: '#DDEBFF'}}>Your idea, brought to life.</div></div>
            </div>
            <div style={{display: 'flex', gap: 9 * scale, marginTop: 16 * scale}}>
              {['Preview', 'Code', 'Export'].map((x, i) => <div key={x} style={{flex: 1, textAlign: 'center', padding: 11 * scale, borderRadius: 10, background: i === 0 ? C.blue : '#17243A', fontSize: 11 * scale, fontWeight: 800}}>{x}</div>)}
            </div>
            <div style={{marginTop: 24 * scale, padding: 14 * scale, background: '#102A2B', border: '1px solid #246D60', borderRadius: 13 * scale, color: '#8DF0C9', fontSize: 12 * scale}}>✓ Project siap dilanjutkan</div>
          </div>
        )}
        <div style={{position: 'absolute', bottom: 13 * scale, left: '50%', transform: 'translateX(-50%)', width: 110 * scale, height: 5 * scale, borderRadius: 10, background: '#DCE5F2'}} />
      </div>
    </div>
  );
};

const FloatingTag: React.FC<{children: React.ReactNode; top: number; left: number; delay?: number}> = ({children, top, left, delay = 0}) => {
  const f = useCurrentFrame();
  const p = spring({frame: f - delay, fps: 30, config: {damping: 14, stiffness: 100}});
  return <div style={{position: 'absolute', top, left, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, padding: '16px 22px', borderRadius: 16, background: 'rgba(18,32,55,.88)', border: '1px solid rgba(115,160,230,.3)', color: C.white, fontSize: 22, fontWeight: 800, boxShadow: '0 15px 40px rgba(0,0,0,.3)'}}>{children}</div>;
};

const Scene: React.FC<{kind: number}> = ({kind}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const enter = fadeUp(frame, 4);
  const center = {justifyContent: 'center' as const, alignItems: 'center' as const, textAlign: 'center' as const};

  return (
    <AbsoluteFill style={{background: 'linear-gradient(145deg,#080D19 0%,#0C1730 55%,#10102A 100%)', color: C.white, fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden'}}>
      <Glow x={kind % 2 ? '78%' : '18%'} y={kind % 2 ? '24%' : '75%'} color={kind === 5 ? C.violet : C.blue} />
      <div style={{position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'linear-gradient(rgba(130,170,230,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(130,170,230,.35) 1px,transparent 1px)', backgroundSize: '70px 70px', maskImage: 'linear-gradient(to bottom,black,transparent)'}} />
      <div style={{position: 'absolute', top: 78, left: 76, right: 76, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5}}>
        <Wordmark /><div style={{color: '#8394B2', fontSize: 19, letterSpacing: 3, fontWeight: 700}}>IDEA → CREATE</div>
      </div>

      {kind === 0 && (
        <AbsoluteFill style={{...center, padding: 90}}>
          <div style={{...enter, position: 'relative', zIndex: 2}}>
            <Eyebrow>CREATIVITY IN YOUR POCKET</Eyebrow>
            <div style={{marginTop: 38, fontSize: 104, lineHeight: 0.98, fontWeight: 950, letterSpacing: -5}}>CUMA<br/>PAKAI <span style={{color: C.cyan}}>HP.</span></div>
            <div style={{marginTop: 30, color: C.muted, fontSize: 34, lineHeight: 1.35}}>Bisa bikin hal keren<br/>dengan bantuan AI.</div>
          </div>
          <div style={{position: 'absolute', right: -75, bottom: 170, opacity: 0.72}}><Phone scale={0.7} /></div>
          <FloatingTag top={1040} left={80} delay={12}>NO LAPTOP NEEDED</FloatingTag>
        </AbsoluteFill>
      )}

      {kind === 1 && (
        <AbsoluteFill style={{...center, padding: 80}}>
          <div style={{position: 'absolute', right: 20, top: 300}}><Phone mode="chat" scale={0.82} /></div>
          <div style={{position: 'absolute', left: 82, top: 480, width: 560, textAlign: 'left', zIndex: 3}}>
            <div style={enter}><Eyebrow>STEP 01 · THINK</Eyebrow><div style={{marginTop: 28, fontSize: 76, fontWeight: 950, lineHeight: 1.05}}>Mulai dari<br/><span style={{color: C.cyan}}>chatbot.</span></div><div style={{marginTop: 28, color: C.muted, fontSize: 30, lineHeight: 1.4}}>Jadikan AI teman brainstorming. Ceritakan ide, tujuan, dan hasil yang kamu mau.</div></div>
          </div>
          <FloatingTag top={1190} left={80} delay={18}>IDE → PROMPT → PLAN</FloatingTag>
        </AbsoluteFill>
      )}

      {kind === 2 && (
        <AbsoluteFill style={{...center, padding: 80}}>
          <div style={{...enter, position: 'absolute', top: 260, left: 85, right: 85, textAlign: 'left'}}>
            <Eyebrow>STEP 02 · PLAN</Eyebrow>
            <div style={{marginTop: 25, fontSize: 75, fontWeight: 950, lineHeight: 1.05}}>Ubah ide jadi<br/><span style={{color: C.cyan}}>rencana nyata.</span></div>
            <div style={{marginTop: 22, color: C.muted, fontSize: 29}}>Minta chatbot menyusun konsep, naskah, prompt visual, bahkan struktur aplikasi.</div>
          </div>
          <div style={{position: 'absolute', bottom: 210, left: 95, right: 95, display: 'flex', gap: 18}}>
            {['KONSEP', 'NASKAH', 'PROMPT'].map((x, i) => <div key={x} style={{flex: 1, padding: '28px 10px', borderRadius: 20, background: 'linear-gradient(145deg,#142746,#101A2D)', border: '1px solid #29456C', textAlign: 'center', ...fadeUp(frame, 12 + i * 7)}}><div style={{color: C.cyan, fontSize: 38, marginBottom: 12}}>{['✧', '✎', '⌘'][i]}</div><div style={{fontSize: 20, fontWeight: 900, letterSpacing: 2}}>{x}</div></div>)}
          </div>
        </AbsoluteFill>
      )}

      {kind === 3 && (
        <AbsoluteFill style={{...center, padding: 80}}>
          <div style={{position: 'absolute', left: 30, top: 330}}><Phone mode="ideas" scale={0.73} /></div>
          <div style={{position: 'absolute', right: 80, top: 420, width: 470, textAlign: 'left', ...enter}}>
            <Eyebrow>STEP 03 · CREATE</Eyebrow>
            <div style={{marginTop: 26, fontSize: 76, fontWeight: 950, lineHeight: 1.05}}>Lanjut ke<br/><span style={{color: C.cyan}}>BYGA.AI.</span></div>
            <div style={{marginTop: 26, color: C.muted, fontSize: 29, lineHeight: 1.4}}>Gunakan tools AI untuk membantu mewujudkan ide menjadi karya digital.</div>
          </div>
          <FloatingTag top={1240} left={600} delay={18}>CREATE WITH AI ✦</FloatingTag>
        </AbsoluteFill>
      )}

      {kind === 4 && (
        <AbsoluteFill style={{...center, padding: 70}}>
          <div style={{position: 'absolute', top: 250, left: 80, right: 80, textAlign: 'center', ...enter}}>
            <Eyebrow>FROM IDEA TO OUTPUT</Eyebrow>
            <div style={{marginTop: 25, fontSize: 75, fontWeight: 950, lineHeight: 1.05}}>Bukan cuma ngobrol.<br/><span style={{color: C.cyan}}>Mulai bikin sesuatu.</span></div>
          </div>
          <div style={{position: 'absolute', bottom: 190, left: 150}}><Phone mode="build" scale={0.76} /></div>
          <div style={{position: 'absolute', right: 90, bottom: 360, width: 430, textAlign: 'left', ...fadeUp(frame, 15)}}>
            {['Website & landing page', 'Konten dan visual', 'Prototype ide aplikasi'].map((x) => <div key={x} style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28, fontSize: 27, fontWeight: 800}}><span style={{color: C.green, fontSize: 32}}>✓</span>{x}</div>)}
          </div>
        </AbsoluteFill>
      )}

      {kind === 5 && (
        <AbsoluteFill style={{...center, padding: 80}}>
          <div style={{...enter, position: 'relative', zIndex: 2}}>
            <Eyebrow>YOUR TURN TO CREATE</Eyebrow>
            <div style={{marginTop: 36, fontSize: 88, lineHeight: 1.02, fontWeight: 950, letterSpacing: -3}}>Jangan cuma<br/>jadi pengguna.</div>
            <div style={{marginTop: 18, fontSize: 88, lineHeight: 1.02, fontWeight: 950, color: C.cyan, letterSpacing: -3}}>Jadi pencipta.</div>
            <div style={{marginTop: 44, display: 'inline-flex', padding: '20px 34px', borderRadius: 18, background: `linear-gradient(100deg,${C.blue},${C.violet})`, fontSize: 28, fontWeight: 900, letterSpacing: 1}}>CHATBOT + BYGA.AI</div>
            <div style={{marginTop: 34, color: C.muted, fontSize: 26}}>Ide besar bisa dimulai dari HP kamu.</div>
          </div>
          <div style={{position: 'absolute', bottom: 125, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 0.8}}><Wordmark /></div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const Byga60s: React.FC = () => {
  const frame = useCurrentFrame();
  const sceneFrames = [180, 240, 330, 360, 330, 360];
  let from = 0;
  const scenes = sceneFrames.map((duration, index) => {
    const start = from;
    from += duration;
    return {duration, start, index};
  });
  const progress = interpolate(frame, [0, 1800], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      {scenes.map(({duration, start, index}) => (
        <Sequence key={index} from={start} durationInFrames={duration}>
          <Scene kind={index} />
        </Sequence>
      ))}
      <div style={{position: 'absolute', bottom: 48, left: 78, right: 78, height: 5, borderRadius: 9, background: 'rgba(255,255,255,.13)', pointerEvents: 'none'}}>
        <div style={{height: '100%', width: `${progress}%`, background: C.cyan, borderRadius: 9}} />
      </div>
    </AbsoluteFill>
  );
};

export const byga60sConfig = {durationInFrames: 1800, fps: 30, width: 1080, height: 1920};

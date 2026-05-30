// /dashboard/src/Home.js

import React, { useEffect, useRef, useState } from 'react';
import WorkflowPage from './Workflowpage';
import Subscription from './Subscription';

// ── Cursor-reactive particle background ───────────────────────────────────────
function ParticleBackground() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const targetMouse = useRef({ x: 0.5, y: 0.5 });
  const animRef = useRef(null);
  const nodesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
      targetMouse.current = { x: e.clientX / W, y: e.clientY / H };
    });

    const cols = 24, rows = 15;
    nodesRef.current = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        nodesRef.current.push({
          bx: (i / (cols - 1)) * W,
          by: (j / (rows - 1)) * H,
          x: (i / (cols - 1)) * W,
          y: (j / (rows - 1)) * H,
          size: Math.random() * 1.5 + 0.5,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }

    let t = 0;
    const draw = () => {
      mouse.current.x += (targetMouse.current.x - mouse.current.x) * 0.05;
      mouse.current.y += (targetMouse.current.y - mouse.current.y) * 0.05;
      ctx.clearRect(0, 0, W, H);

      const grad = ctx.createRadialGradient(mouse.current.x * W, mouse.current.y * H, 0, W / 2, H / 2, Math.max(W, H));
      grad.addColorStop(0, '#050d1a');
      grad.addColorStop(0.4, '#020810');
      grad.addColorStop(1, '#000305');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const cg = ctx.createRadialGradient(mouse.current.x * W, mouse.current.y * H, 0, mouse.current.x * W, mouse.current.y * H, 350);
      cg.addColorStop(0, 'rgba(0,220,180,0.07)');
      cg.addColorStop(0.5, 'rgba(0,120,255,0.04)');
      cg.addColorStop(1, 'transparent');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);

      for (let y = 0; y < H; y += 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.fillRect(0, y, W, 1);
      }

      const mx = mouse.current.x * W, my = mouse.current.y * H;
      nodesRef.current.forEach((n) => {
        const dx = mx - n.bx, dy = my - n.by;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = Math.max(0, 1 - dist / 380);
        n.pulse += 0.015;
        const tx = n.bx + dx * pull * 0.18 + Math.sin(t * 0.4 + n.pulse) * 6;
        const ty = n.by + dy * pull * 0.18 + Math.cos(t * 0.3 + n.pulse) * 6;
        n.x += (tx - n.x) * 0.08;
        n.y += (ty - n.y) * 0.08;
        const alpha = 0.2 + pull * 0.8 + Math.sin(n.pulse) * 0.1;
        const size = n.size + pull * 2.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
        ctx.fillStyle = pull > 0.3 ? `rgba(0,220,180,${alpha})` : `rgba(0,100,200,${alpha * 0.6})`;
        ctx.fill();
      });

      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) {
            const alpha = (1 - d / 90) * 0.15;
            const adx = mx - a.x, ady = my - a.y;
            const near = Math.sqrt(adx * adx + ady * ady) < 260;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = near ? `rgba(0,220,180,${alpha * 3})` : `rgba(0,100,200,${alpha})`;
            ctx.lineWidth = near ? 0.8 : 0.4;
            ctx.stroke();
          }
        }
      }

      const sweepY = (t * 0.4) % H;
      const sg = ctx.createLinearGradient(0, sweepY - 40, 0, sweepY + 2);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(1, 'rgba(0,220,180,0.04)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, sweepY - 40, W, 42);

      t++;
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      zIndex: 0, pointerEvents: 'none',
    }} />
  );
}

// ── Feature Card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, accent, delay, wide }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        padding: '28px 24px',
        background: hovered ? 'rgba(0,8,20,0.85)' : 'rgba(0,5,12,0.6)',
        border: `1px solid ${hovered ? accent : 'rgba(0,200,160,0.18)'}`,
        backdropFilter: 'blur(8px)',
        transition: 'all 0.3s ease',
        boxShadow: hovered ? `0 0 32px ${accent}22, inset 0 0 32px ${accent}06` : 'none',
        animationDelay: delay,
        animation: 'fadeUp 0.6s ease backwards',
        overflow: 'hidden',
        cursor: 'default',
        gridColumn: wide ? 'span 2' : 'span 1',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: 10, height: 10, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
      <div style={{ fontSize: 26, marginBottom: 12 }}>{icon}</div>
      <div style={{
        fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 700,
        color: accent, letterSpacing: 2, marginBottom: 10,
        textShadow: hovered ? `0 0 12px ${accent}` : 'none',
        transition: 'text-shadow 0.3s',
      }}>{title}</div>
      <div style={{
        fontFamily: "'Share Tech Mono', monospace", fontSize: 13,
        color: '#8ecfbf', lineHeight: 1.8, letterSpacing: 0.5,
      }}>{desc}</div>
    </div>
  );
}

// ── Step Row ──────────────────────────────────────────────────────────────────
function StepRow({ step, title, desc, accent, i }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '64px 1fr',
      gap: 28,
      alignItems: 'flex-start',
      padding: '28px 0',
      borderBottom: i < 4 ? '1px solid rgba(0,220,155,0.07)' : 'none',
      animation: `fadeUp 0.5s ${i * 0.08}s ease backwards`,
    }}>
      <div style={{
        fontFamily: "'Orbitron', monospace", fontSize: 36, fontWeight: 900,
        color: accent, opacity: 0.2, lineHeight: 1, textAlign: 'right',
      }}>{step}</div>
      <div>
        <div style={{
          fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 700,
          color: accent, letterSpacing: 3, marginBottom: 8,
        }}>{title}</div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace", fontSize: 13,
          color: '#8ecfbf', lineHeight: 1.9, letterSpacing: 0.4,
        }}>{desc}</div>
      </div>
    </div>
  );
}

// ── Main Home Component ───────────────────────────────────────────────────────
const Home = ({ onEnterDashboard, onGoWorkflow }) => {
  const [mounted, setMounted] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
  }, []);

  return (
    <>
      <style>{css}</style>
      <ParticleBackground />

      {/* Subscription Modal */}
      {showSubscription && (
        <Subscription onClose={() => setShowSubscription(false)} />
      )}

      {/* ── PAGE CONTENT ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease',
        fontFamily: "'Share Tech Mono', monospace",
      }}>

        {/* ── HERO — two-column layout ── */}
        <section style={{
          minHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          alignItems: 'center',
          padding: '100px 64px 80px',
          maxWidth: 1280,
          margin: '0 auto',
        }}>
          {/* Left column */}
          <div style={{ paddingRight: 48 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px',
              border: '1px solid rgba(0,220,155,0.3)',
              background: 'rgba(0,220,155,0.07)',
              marginBottom: 32, animation: 'fadeUp 0.5s ease backwards',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: '#00dc9b',
                boxShadow: '0 0 8px #00dc9b', animation: 'pulse 1.5s infinite',
              }} />
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 9, color: '#00dc9b', letterSpacing: 3 }}>
                SYSTEM OPERATIONAL · v2.4.1
              </span>
            </div>

            <h1 style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 'clamp(32px, 5vw, 72px)',
              fontWeight: 900, lineHeight: 1.05,
              color: '#e8f8f4', letterSpacing: 3,
              textShadow: '0 0 60px rgba(0,220,155,0.15)',
              marginBottom: 20,
              animation: 'fadeUp 0.5s 0.1s ease backwards',
            }}>
              Log<span style={{ color: '#00dc9b', textShadow: '0 0 40px #00dc9b' }}>Watch</span>
              <span style={{ color: '#00b4ff', textShadow: '0 0 40px #00b4ff' }}>AI</span>
            </h1>

            <p style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 14, color: '#7dd8c8', letterSpacing: 2,
              marginBottom: 12, lineHeight: 1.7,
              animation: 'fadeUp 0.5s 0.2s ease backwards',
            }}>
              Intelligent log analysis · canary deployment · auto-rollback
            </p>

            <p style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 13, color: '#5ab8a5', letterSpacing: 1,
              maxWidth: 480, lineHeight: 2,
              marginBottom: 44,
              animation: 'fadeUp 0.5s 0.3s ease backwards',
            }}>
              Real-time traffic control and AI-powered incident detection built for teams that ship fast and can't afford downtime.
            </p>

            <div style={{
              display: 'flex', gap: 14, flexWrap: 'wrap',
              animation: 'fadeUp 0.5s 0.4s ease backwards',
            }}>
              <button
                onClick={onEnterDashboard}
                style={{
                  padding: '14px 32px',
                  background: 'rgba(0,220,155,0.1)',
                  border: '1px solid #00dc9b',
                  color: '#00dc9b',
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 11, letterSpacing: 3,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  boxShadow: '0 0 24px rgba(0,220,155,0.15)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(0,220,155,0.2)';
                  e.currentTarget.style.boxShadow = '0 0 40px rgba(0,220,155,0.35)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(0,220,155,0.1)';
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(0,220,155,0.15)';
                }}
              >
                ⬡ VIEW DASHBOARD
              </button>
              <button
                onClick={onGoWorkflow}
                style={{
                  padding: '14px 32px',
                  background: 'transparent',
                  border: '1px solid rgba(0,180,255,0.4)',
                  color: '#00b4ff',
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 11, letterSpacing: 3,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(0,180,255,0.08)';
                  e.currentTarget.style.borderColor = '#00b4ff';
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(0,180,255,0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0,180,255,0.4)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                ◈ WORKFLOW
              </button>
            </div>
          </div>

          {/* Right column — terminal mock */}
          <div style={{
            animation: 'fadeUp 0.6s 0.3s ease backwards',
            position: 'relative',
          }}>
            <div style={{
              background: 'rgba(0,5,12,0.85)',
              border: '1px solid rgba(0,220,155,0.2)',
              backdropFilter: 'blur(12px)',
              padding: '20px 24px',
              boxShadow: '0 0 60px rgba(0,220,155,0.06)',
            }}>
              {/* Terminal top bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 20, paddingBottom: 14,
                borderBottom: '1px solid rgba(0,220,155,0.1)',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3355' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00dc9b' }} />
                <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, color: '#4a9080', letterSpacing: 2, marginLeft: 8 }}>
                  LOGWATCH · LIVE FEED
                </span>
              </div>

              {/* Log lines */}
              {[
                { time: '14:22:01', level: 'INFO',  msg: 'Canary traffic at 10% — stable',          col: '#00dc9b' },
                { time: '14:22:04', level: 'WARN',  msg: '/api/checkout → 503 spike detected',       col: '#f59e0b' },
                { time: '14:22:04', level: 'AI',    msg: 'Clustering 47 similar 503 events…',        col: '#a78bfa' },
                { time: '14:22:05', level: 'ERROR', msg: 'Error rate crossed threshold (8.3%)',       col: '#ff3355' },
                { time: '14:22:05', level: 'SYS',   msg: 'Auto-rollback triggered → stable build',   col: '#00b4ff' },
                { time: '14:22:06', level: 'AI',    msg: 'Root cause: null ref in CartService.js:84', col: '#a78bfa' },
                { time: '14:22:07', level: 'PATCH', msg: 'AI patch generated — awaiting approval',   col: '#00ffcc' },
                { time: '14:22:08', level: 'INFO',  msg: 'Error rate → 0.1% — system recovered',     col: '#00dc9b' },
              ].map((log, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '72px 52px 1fr',
                  gap: 10, marginBottom: 8,
                  fontFamily: "'Share Tech Mono', monospace", fontSize: 11,
                  animation: `fadeUp 0.4s ${0.5 + i * 0.07}s ease backwards`,
                }}>
                  <span style={{ color: '#4a9080' }}>{log.time}</span>
                  <span style={{ color: log.col, fontWeight: 700 }}>[{log.level}]</span>
                  <span style={{ color: '#8ecfbf' }}>{log.msg}</span>
                </div>
              ))}

              {/* Blinking cursor */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 12,
              }}>
                <span style={{ color: '#00dc9b' }}>▶</span>
                <div style={{ width: 7, height: 14, background: '#00dc9b', animation: 'pulse 1s infinite' }} />
              </div>
            </div>

            {/* Glow under terminal */}
            <div style={{
              position: 'absolute', bottom: -30, left: '20%', right: '20%',
              height: 60, background: 'rgba(0,220,155,0.06)',
              filter: 'blur(24px)', zIndex: -1,
            }} />
          </div>
        </section>

        {/* ── FEATURES — bento grid ── */}
        <section id="features" style={{
          padding: '80px 64px',
          maxWidth: 1280, margin: '0 auto',
          borderTop: '1px solid rgba(0,220,155,0.07)',
        }}>
          <div style={{ marginBottom: 52 }}>
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 10, color: '#00dc9b', letterSpacing: 4, marginBottom: 12 }}>
              // CAPABILITIES
            </div>
            <h2 style={{
              fontFamily: "'Orbitron', monospace", fontSize: 'clamp(20px, 3.5vw, 32px)',
              fontWeight: 900, color: '#e8f8f4', letterSpacing: 3,
            }}>
              Everything your infra needs
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}>
            <FeatureCard delay="0s"    accent="#00dc9b" icon="🔬" title="AI LOG ANALYSIS"
              desc="Automatic failure clustering with plain-English root-cause reports. Powered by Groq AI — results in seconds." />
            <FeatureCard delay="0.07s" accent="#00b4ff" icon="⬡"  title="CANARY DEPLOYMENT"
              desc="Gradually shift traffic to a new build. Tune the percentage in real time without editing config files." />
            <FeatureCard delay="0.14s" accent="#ff3355" icon="⏮"  title="AUTO ROLLBACK"
              desc="Crosses your error threshold? Instant rollback to stable — automatically, before users feel the impact." />
            <FeatureCard delay="0.21s" accent="#f59e0b" icon="📈"  title="REAL-TIME TIMELINE"
              desc="Full request history with adaptive bucket sizes. Error rates plotted across every time window at a glance." />
            <FeatureCard delay="0.28s" accent="#a78bfa" icon="🗂️" title="FAILURE CLUSTERING"
              desc="Groups similar errors by status code and message fingerprint. Surfaces affected backends, paths, and timing." />
            <FeatureCard delay="0.35s" accent="#00ffcc" icon="🛠️" title="AI CODE PATCH"
              desc="Generates a fix, runs it in a sandbox, and deploys after your approval. Free tier: 5 patches/month." />
          </div>
        </section>

        {/* ── HOW IT WORKS — left-pinned steps + right content ── */}
        <section id="how-it-works" style={{
          padding: '80px 64px',
          background: 'rgba(0,5,12,0.5)',
          borderTop: '1px solid rgba(0,220,155,0.07)',
          borderBottom: '1px solid rgba(0,220,155,0.07)',
        }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 80, alignItems: 'start' }}>
            {/* Sticky left label */}
            <div style={{ position: 'sticky', top: 120 }}>
              <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 10, color: '#00b4ff', letterSpacing: 4, marginBottom: 12 }}>
                // ARCHITECTURE
              </div>
              <h2 style={{
                fontFamily: "'Orbitron', monospace", fontSize: 'clamp(18px, 2.5vw, 26px)',
                fontWeight: 900, color: '#e8f8f4', letterSpacing: 3, lineHeight: 1.3,
              }}>
                How it<br />works
              </h2>
              <div style={{ marginTop: 24, width: 40, height: 2, background: 'linear-gradient(90deg, #00b4ff, transparent)' }} />
            </div>

            {/* Steps */}
            <div>
              {[
                { step: '01', title: 'TRAFFIC INGRESS',    desc: 'Requests flow through the LogWatch proxy. Each is timestamped and tagged with a backend identity in real time.',                                accent: '#00dc9b' },
                { step: '02', title: 'CANARY SPLITTING',   desc: 'Configurable weights route traffic to your canary build. Switch between stable, partial canary, or full test mode instantly.',              accent: '#00b4ff' },
                { step: '03', title: 'ANOMALY DETECTION',  desc: 'Error rates are tracked per time window. When your threshold is crossed, auto-rollback fires and the event is logged.',                     accent: '#f59e0b' },
                { step: '04', title: 'AI INCIDENT REPORT', desc: 'Logs are sent to Groq AI, which returns a structured report: what broke, which backend, the affected path, and a recommended fix.',         accent: '#a78bfa' },
                { step: '05', title: 'AI CODE PATCH',      desc: 'A fix is generated, tested in a sandbox environment, then queued for deployment. Approval is required before it goes live.',               accent: '#00ffcc' },
              ].map((item, i) => (
                <StepRow key={i} {...item} i={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING / SUBSCRIPTION ── */}
        <section id="pricing" style={{
          padding: '100px 64px',
          maxWidth: 1280, margin: '0 auto',
        }}>
          <div style={{ marginBottom: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 10, color: '#00ffcc', letterSpacing: 4, marginBottom: 12 }}>
                // AI PATCH PLANS
              </div>
              <h2 style={{
                fontFamily: "'Orbitron', monospace", fontSize: 'clamp(20px, 3.5vw, 32px)',
                fontWeight: 900, color: '#e8f8f4', letterSpacing: 3,
              }}>
                Unlock more AI code patches
              </h2>
              <p style={{
                fontFamily: "'Share Tech Mono', monospace", fontSize: 12,
                color: '#7ecfbe', letterSpacing: 1, lineHeight: 1.9, marginTop: 12, maxWidth: 520,
              }}>
                The free tier includes 5 AI bug-fix patches per month. Upgrade to remove limits and unlock sandbox testing, auto-deploy, and unlimited incident analysis.
              </p>
            </div>
          </div>

          {/* Plan cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {[
              {
                name: 'STARTER', label: 'Free', price: 0, accent: '#6ab8a8', disabled: true,
                limit: '5 patches / month',
                features: ['5 AI code patch requests/mo','Full root-cause AI reports', 'Auto-rollback ', 'Failure clustering & timeline'],
                cta: 'Current Plan',
              },
              {
                name: 'PRO', label: '₹999 / mo', price: 999, accent: '#00dc9b', badge: 'MOST POPULAR', disabled: false,
                limit: '100 patches / month',
                features: ['100 AI code patch requests/mo', 'Full root-cause AI reports', 'Auto-rollback ', 'Failure clustering & timeline'],
                cta: 'Upgrade to Pro',
                desc: '100 patches/month',
              },
              {
                name: 'MAX', label: '₹2,999 / mo', price: 2999, accent: '#00b4ff', disabled: false,
                limit: 'Unlimited patches',
                features: ['Unlimited AI code patches',  'Nmapic AI reports', 'Full root-cause AI reports', 'Auto-rollback ', 'Failure clustering & timeline'],
                cta: 'Upgrade to Team',
                desc: 'Unlimited patches',
              },
            ].map((plan, pi) => (
              <PricingCard
                key={plan.name}
                plan={plan}
                onSelect={() => {
                  if (!plan.disabled) {
                    import('./razorpay').then(({ openRazorpayCheckout }) => {
                      openRazorpayCheckout({
                        planName: plan.name,
                        amount: plan.price,
                        description: `LogWatchAI ${plan.name} Plan — ${plan.limit}`,
                      });
                    });
                  }
                }}
              />
            ))}
          </div>

          <div style={{
            marginTop: 32, fontFamily: "'Share Tech Mono', monospace",
            fontSize: 10, color: '#3a8070', letterSpacing: 2,
          }}>
            Payments secured by Razorpay · Cancel anytime · No hidden fees
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{
          padding: '80px 64px',
          background: 'rgba(0,5,12,0.5)',
          borderTop: '1px solid rgba(0,220,155,0.07)',
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 10, color: '#00dc9b', letterSpacing: 4, marginBottom: 20 }}>
              // READY TO DEPLOY
            </div>
            <h2 style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 'clamp(22px, 4vw, 40px)',
              fontWeight: 900, color: '#e8f8f4',
              letterSpacing: 3, marginBottom: 18, lineHeight: 1.2,
            }}>
              Your infra deserves<br />
              <span style={{ color: '#00dc9b', textShadow: '0 0 30px #00dc9b88' }}>real intelligence.</span>
            </h2>
            <p style={{
              fontFamily: "'Share Tech Mono', monospace", fontSize: 13,
              color: '#7ecfbe', letterSpacing: 1, lineHeight: 1.9, marginBottom: 36,
            }}>
              Stop manually reading logs. Let LogWatch AI surface what matters, roll back what breaks, and explain what went wrong — automatically.
            </p>
            <button
              onClick={onEnterDashboard}
              style={{
                padding: '16px 44px',
                background: 'rgba(0,220,155,0.1)',
                border: '1px solid #00dc9b',
                color: '#00dc9b',
                fontFamily: "'Orbitron', monospace",
                fontSize: 12, letterSpacing: 4,
                cursor: 'pointer',
                boxShadow: '0 0 32px rgba(0,220,155,0.2)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,220,155,0.2)';
                e.currentTarget.style.boxShadow = '0 0 60px rgba(0,220,155,0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(0,220,155,0.1)';
                e.currentTarget.style.boxShadow = '0 0 32px rgba(0,220,155,0.2)';
              }}
            >
              ⬡ ENTER DASHBOARD
            </button>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{
          borderTop: '1px solid rgba(0,220,155,0.08)',
          padding: '28px 64px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#00dc9b', fontSize: 16 }}>⬡</span>
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#4aaa90', letterSpacing: 2 }}>
              LogWatch<span style={{ color: '#00dc9b' }}>AI</span>
            </span>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#4a9080', letterSpacing: 2 }}>
            RAG · PINECONE · GROQ · RAZORPAY · {new Date().getFullYear()}
          </div>
          <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 9, color: '#4a9080', letterSpacing: 2 }}>
            BUILT FOR ZERO-DOWNTIME TEAMS
          </div>
        </footer>
      </div>
    </>
  );
};

// ── Pricing Card (inline, used only in Home) ───────────────────────────────────
function PricingCard({ plan, onSelect }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        padding: '32px 26px',
        background: hovered && !plan.disabled ? 'rgba(0,8,20,0.95)' : 'rgba(0,5,12,0.7)',
        border: `1px solid ${hovered && !plan.disabled ? plan.accent : 'rgba(0,200,160,0.15)'}`,
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease',
        boxShadow: hovered && !plan.disabled ? `0 0 40px ${plan.accent}22` : 'none',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: 12, height: 12, borderTop: `2px solid ${plan.accent}`, borderLeft: `2px solid ${plan.accent}` }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderBottom: `2px solid ${plan.accent}`, borderRight: `2px solid ${plan.accent}` }} />

      {plan.badge && (
        <div style={{
          position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
          background: plan.accent, color: '#000',
          fontFamily: "'Orbitron', monospace", fontSize: 8, fontWeight: 700,
          letterSpacing: 3, padding: '3px 12px', whiteSpace: 'nowrap',
        }}>{plan.badge}</div>
      )}

      <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 700, color: plan.accent, letterSpacing: 4, marginBottom: 10 }}>
        {plan.name}
      </div>
      <div style={{
        fontFamily: "'Orbitron', monospace", fontSize: 28, fontWeight: 900,
        color: '#e8f8f4', marginBottom: 4, lineHeight: 1,
        textShadow: hovered ? `0 0 20px ${plan.accent}55` : 'none', transition: 'text-shadow 0.3s',
      }}>{plan.label}</div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: plan.accent, letterSpacing: 2, marginBottom: 24, opacity: 0.8 }}>
        {plan.limit}
      </div>

      <div style={{ height: 1, background: `linear-gradient(90deg, ${plan.accent}33, transparent)`, marginBottom: 20 }} />

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, marginBottom: 28 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: '#8ecfbf', display: 'flex', gap: 8 }}>
            <span style={{ color: plan.accent, flexShrink: 0 }}>›</span>{f}
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={plan.disabled}
        style={{
          padding: '12px 20px',
          background: plan.disabled ? 'rgba(255,255,255,0.04)' : hovered ? `${plan.accent}22` : `${plan.accent}0f`,
          border: `1px solid ${plan.disabled ? 'rgba(255,255,255,0.07)' : plan.accent}`,
          color: plan.disabled ? '#4a6a60' : plan.accent,
          fontFamily: "'Orbitron', monospace", fontSize: 10, letterSpacing: 3,
          cursor: plan.disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          width: '100%',
        }}
      >
        {plan.cta}
      </button>
    </div>
  );
}

// ── Global CSS ────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000305; overflow-x: hidden; cursor: crosshair; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #00dc9b33; border-radius: 2px; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
  }
  @keyframes scrollPulse {
    0%, 100% { opacity: 0.4; } 50% { opacity: 1; }
  }

  @media (max-width: 900px) {
    section[style*="grid-template-columns: 1fr 1fr"] {
      grid-template-columns: 1fr !important;
    }
    section[style*="grid-template-columns: 260px 1fr"] {
      grid-template-columns: 1fr !important;
    }
    section[style*="padding: 100px 64px"],
    section[style*="padding: 80px 64px"],
    footer[style*="padding: 28px 64px"] {
      padding-left: 24px !important;
      padding-right: 24px !important;
    }
  }
`;

export default Home;
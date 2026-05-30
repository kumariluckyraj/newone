// /dashboard/src/Subscription.jsx
// Drop this file in /dashboard/src/ alongside Home.js

import React, { useState } from 'react';
import { openRazorpayCheckout } from './razorpay';

const PLANS = [
  {
    id: 'starter',
    name: 'STARTER',
    price: 0,
    label: 'Free',
    accent: '#6ab8a8',
    features: [
      '5 AI code patch requests / month',
      
    ],
    limit: '5 patches/mo',
    cta: 'Current Plan',
    disabled: true,
  },
  {
    id: 'pro',
    name: 'PRO',
    price: 999,
    label: '₹999 / mo',
    accent: '#00dc9b',
    badge: 'MOST POPULAR',
    features: [
      '100 AI code patch requests / month',
      'Full root-cause AI reports',
      'Auto-rollback with threshold config',
      'Failure clustering & timeline',
      'Email incident alerts',
      'Priority support',
    ],
    limit: '100 patches/mo',
    cta: 'Upgrade to Pro',
    disabled: false,
  },
  {
    id: 'team',
    name: 'TEAM',
    price: 2999,
    label: '₹2,999 / mo',
    accent: '#00b4ff',
    features: [
      'Unlimited AI code patches',
      'Multi-repo support',
      'Sandbox test runs before deploy',
      'Webhook & Slack integration',
      'Custom rollback policies',
      'Dedicated support channel',
    ],
    limit: 'Unlimited',
    cta: 'Upgrade to Team',
    disabled: false,
  },
];

function PlanCard({ plan, onSelect }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        padding: '32px 28px',
        background: hovered && !plan.disabled
          ? 'rgba(0,8,20,0.95)'
          : 'rgba(0,5,12,0.7)',
        border: `1px solid ${hovered && !plan.disabled ? plan.accent : 'rgba(0,200,160,0.15)'}`,
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease',
        boxShadow: hovered && !plan.disabled
          ? `0 0 40px ${plan.accent}22, inset 0 0 24px ${plan.accent}06`
          : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        flex: '1 1 260px',
        minWidth: 240,
        maxWidth: 340,
      }}
    >
      {/* Corner brackets */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 12, height: 12, borderTop: `2px solid ${plan.accent}`, borderLeft: `2px solid ${plan.accent}` }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderBottom: `2px solid ${plan.accent}`, borderRight: `2px solid ${plan.accent}` }} />

      {/* Badge */}
      {plan.badge && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: plan.accent, color: '#000',
          fontFamily: "'Orbitron', monospace", fontSize: 8, fontWeight: 700,
          letterSpacing: 3, padding: '4px 12px',
          whiteSpace: 'nowrap',
        }}>{plan.badge}</div>
      )}

      {/* Plan name */}
      <div style={{
        fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 700,
        color: plan.accent, letterSpacing: 4, marginBottom: 12,
      }}>{plan.name}</div>

      {/* Price */}
      <div style={{
        fontFamily: "'Orbitron', monospace",
        fontSize: plan.price === 0 ? 28 : 34,
        fontWeight: 900, color: '#e8f8f4',
        textShadow: hovered ? `0 0 20px ${plan.accent}66` : 'none',
        marginBottom: 4, transition: 'text-shadow 0.3s',
        lineHeight: 1,
      }}>{plan.label}</div>

      {/* Limit tag */}
      <div style={{
        fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
        color: plan.accent, letterSpacing: 2, marginBottom: 28,
        opacity: 0.8,
      }}>{plan.limit}</div>

      {/* Divider */}
      <div style={{ height: 1, background: `linear-gradient(90deg, ${plan.accent}33, transparent)`, marginBottom: 24 }} />

      {/* Features */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, marginBottom: 32 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{
            fontFamily: "'Share Tech Mono', monospace", fontSize: 12,
            color: '#8ecfbf', letterSpacing: 0.5, display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span style={{ color: plan.accent, flexShrink: 0, marginTop: 1 }}>›</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={() => !plan.disabled && onSelect(plan)}
        disabled={plan.disabled}
        style={{
          padding: '13px 20px',
          background: plan.disabled
            ? 'rgba(255,255,255,0.04)'
            : hovered
              ? `rgba(${plan.accent === '#00dc9b' ? '0,220,155' : plan.accent === '#00b4ff' ? '0,180,255' : '106,184,168'},0.18)`
              : `rgba(${plan.accent === '#00dc9b' ? '0,220,155' : plan.accent === '#00b4ff' ? '0,180,255' : '106,184,168'},0.08)`,
          border: `1px solid ${plan.disabled ? 'rgba(255,255,255,0.08)' : plan.accent}`,
          color: plan.disabled ? '#4a6a60' : plan.accent,
          fontFamily: "'Orbitron', monospace",
          fontSize: 10, letterSpacing: 3,
          cursor: plan.disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: !plan.disabled && hovered ? `0 0 20px ${plan.accent}33` : 'none',
          width: '100%',
        }}
      >
        {plan.cta}
      </button>
    </div>
  );
}

export default function Subscription({ onClose }) {
  const handleSelect = (plan) => {
    openRazorpayCheckout({
      planName: plan.name,
      amount: plan.price,
      description: `LogWatchAI ${plan.name} Plan — ${plan.limit}`,
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,2,8,0.92)',
      backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      overflowY: 'auto',
    }}>
      {/* Close */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'fixed', top: 24, right: 28,
            background: 'transparent', border: '1px solid rgba(0,220,155,0.3)',
            color: '#00dc9b', fontFamily: "'Orbitron', monospace",
            fontSize: 10, letterSpacing: 2, padding: '7px 14px',
            cursor: 'pointer',
          }}
        >✕ CLOSE</button>
      )}

      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{
          fontFamily: "'Orbitron', monospace", fontSize: 9,
          color: '#00dc9b', letterSpacing: 5, marginBottom: 14,
        }}>// AI PATCH PLANS</div>
        <h2 style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 'clamp(20px, 4vw, 32px)',
          fontWeight: 900, color: '#e8f8f4', letterSpacing: 3,
          marginBottom: 12,
        }}>Unlock more AI code patches</h2>
        <p style={{
          fontFamily: "'Share Tech Mono', monospace", fontSize: 12,
          color: '#7ecfbe', letterSpacing: 1, lineHeight: 1.9,
          maxWidth: 500,
        }}>
          The free tier includes 5 AI bug-fix patches per month.
          Upgrade to remove limits and get sandbox testing + auto-deploy.
        </p>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 20,
        justifyContent: 'center', width: '100%', maxWidth: 1100,
      }}>
        {PLANS.map(plan => (
          <PlanCard key={plan.id} plan={plan} onSelect={handleSelect} />
        ))}
      </div>

      <div style={{
        marginTop: 40, fontFamily: "'Share Tech Mono', monospace",
        fontSize: 10, color: '#3a8070', letterSpacing: 2, textAlign: 'center',
      }}>
        Payments secured by Razorpay · Cancel anytime · No hidden fees
      </div>
    </div>
  );
}
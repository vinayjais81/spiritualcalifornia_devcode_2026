export function TrustStrip() {
  const items = [
    { icon: '🛡️', title: 'Verified Practitioners', desc: 'Every seller is identity-verified and credential-checked' },
    { icon: '🚚', title: 'Conscious Shipping', desc: 'Eco-friendly packaging, carbon-neutral delivery options' },
    { icon: '↩️', title: '30-Day Returns', desc: 'Love it or return it — no questions asked on physical items' },
    { icon: '🔒', title: 'Secure Checkout', desc: 'SSL encrypted payments via Stripe. Your data is always safe' },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 1, background: 'rgba(232,184,75,0.1)',
      border: '1px solid rgba(232,184,75,0.1)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 60,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: '#fff', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>{item.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#3A3530', marginBottom: 4 }}>{item.title}</div>
          <div style={{ fontSize: 12, color: '#8A8278', lineHeight: 1.5 }}>{item.desc}</div>
        </div>
      ))}
    </div>
  );
}

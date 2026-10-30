import { Link } from 'react-router-dom';
import {
  Camera,
  Hand,
  Ruler,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export function HowItWorksPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 1080,
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
          How Try On Studio Works
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Learn how live virtual clothing try-on, gesture navigation, and
          camera-based size estimation work together—and how your camera data is
          handled.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 16,
        }}
      >
        <section className="card bottom-card">
          <div className="bottom-card-title">
            <Camera size={20} color="var(--blue-600)" aria-hidden="true" />
            <span>1. Camera &amp; HTTPS Permissions</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Try On Studio never activates your webcam automatically. When you
            click <strong>Turn On Camera</strong>, your browser requests
            permission via <code>getUserMedia</code> (HTTPS required in
            production). Turning the camera off stops all media tracks
            immediately.
          </p>
        </section>

        <section className="card bottom-card">
          <div className="bottom-card-title">
            <Sparkles size={20} color="var(--purple-600)" aria-hidden="true" />
            <span>2. Decart Live Virtual Try-On</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            When you click <strong>Start Try-On</strong>, the frontend requests
            a short-lived (~2 minute) client token from the backend (never stored
            in browser storage) and streams video over WebRTC to Decart using
            the selected garment&apos;s reference image and prompt. Clicking{' '}
            <strong>Choose This Outfit</strong> immediately disconnects the
            remote session.
          </p>
        </section>

        <section className="card bottom-card">
          <div className="bottom-card-title">
            <Hand size={20} color="var(--blue-600)" aria-hidden="true" />
            <span>3. Hand-Swipe Gesture Switching</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            While a live virtual try-on session is active, MediaPipe Pose runs
            locally in your browser to detect intentional horizontal hand swipes
            above the hip line—swiping right selects the next color or garment,
            and swiping left selects the previous one, with a 1.5s cooldown.
            Manual buttons remain available at all times.
          </p>
        </section>

        <section className="card bottom-card">
          <div className="bottom-card-title">
            <Ruler size={20} color="var(--green-600)" aria-hidden="true" />
            <span>4. Find My Size Body Scan</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Supported for eligible tops (T-Shirts, Polo Shirts, Hoodies, and
            Jackets) that offer manufactured sizes. Stand 1–2 metres back with
            your entire body from head to feet visible and a small gap between
            your arms and body. After a short countdown, 20 resized JPEG frames
            are captured over 3 seconds from the raw camera feed and analyzed
            against the garment&apos;s size chart.
          </p>
        </section>
      </div>

      <section className="card bottom-card">
        <div className="bottom-card-title">
          <ShieldCheck size={20} color="var(--purple-600)" aria-hidden="true" />
          <span>Data &amp; Privacy Transparency</span>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: '0.87rem',
            color: 'var(--text-secondary)',
          }}
        >
          <li>
            <strong>Size Scan:</strong> To find your size, a few photos are sent
            to our server for analysis and are not stored.
          </li>
          <li>
            <strong>Virtual Try-On:</strong> During an active virtual try-on
            session, live camera video is streamed to Decart to generate the
            garment overlay in real time until you disconnect or choose your
            outfit.
          </li>
          <li>
            <strong>Size Availability vs. Inventory:</strong> Size availability
            shown in the catalog indicates whether a garment design is
            manufactured in that size—not real-time warehouse stock.
          </li>
        </ul>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          <Link to="/" className="btn btn-primary">
            Open Try On Studio
          </Link>
          <Link to="/browse" className="btn btn-secondary">
            Browse Catalog &amp; 360° Rack
          </Link>
        </div>
      </section>
    </div>
  );
}


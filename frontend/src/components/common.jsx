import React, { useEffect } from 'react';
import { Copy, ArrowLeft, X } from 'lucide-react';

function Header({ room }) {
  return (
    <header className="topbar">
      <div className="brand-mark">
        <span className="brand-suit">♠</span>
        <span>
          FOUR <b>CARDS</b>
        </span>
      </div>

      {room && (
        <div className="room-pill">
          ROOM <b>{room}</b>
          <Copy size={14} />
        </div>
      )}

      <div className="top-status">
        <span className="status-dot" />
        LIVE TABLE
      </div>
    </header>
  );
}

function Avatar({ name }) {
  return (
    <div className="avatar">
      {name?.slice(0, 1).toUpperCase() || '?'}
    </div>
  );
}

function FormShell({ title, subtitle, onBack, children }) {
  return (
    <section className="center-shell page-shell">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="form-head">
        <div className="eyebrow">
          <span />
          <span>FOUR CARDS</span>
        </div>

        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {children}
    </section>
  );
}

function Spinner() {
  return <div className="spinner" />;
}

function ErrorToast({ message, clear }) {
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(clear, 4500);

    return () => clearTimeout(timer);
  }, [message, clear]);

  if (!message) return null;

  return (
    <div className="toast">
      <X size={16} />
      <span>{message}</span>

      <button onClick={clear}>×</button>
    </div>
  );
}

export {
  Header,
  Avatar,
  FormShell,
  Spinner,
  ErrorToast
};
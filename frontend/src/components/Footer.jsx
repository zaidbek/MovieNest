import React from "react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span className="footer__brand">MovieNest</span>
        <span className="footer__note">
          © {new Date().getFullYear()} MovieNest. Сделано с любовью к кино. Учебный проект.
        </span>
      </div>
    </footer>
  );
}

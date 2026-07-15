import React from "react";

export function CardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton--poster" />
      <div className="skeleton skeleton--line" style={{ width: "80%" }} />
      <div className="skeleton skeleton--line" style={{ width: "50%" }} />
    </div>
  );
}

export function GridSkeleton({ count = 10 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RowSkeleton({ count = 6 }) {
  return (
    <div className="row-scroll">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="skeleton skeleton--hero" />
  );
}

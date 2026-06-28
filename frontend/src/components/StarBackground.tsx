import React, { useEffect, useState } from 'react';

const StarBackground = () => {
  const [stars, setStars] = useState<{ id: number; top: string; left: string; size: string }[]>([]);

  useEffect(() => {
    // Generate random stars on mount
    const newStars = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 10 + 6}px`
    }));
    setStars(newStars);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {stars.map((star) => (
        <span
          key={star.id}
          className="star"
          style={{ top: star.top, left: star.left, fontSize: star.size }}
        >
          ★
        </span>
      ))}
    </div>
  );
};

export default StarBackground;

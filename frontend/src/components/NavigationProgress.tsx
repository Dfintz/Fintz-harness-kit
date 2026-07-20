/**
 * Navigation Progress Component
 * 
 * Shows a loading progress bar at the top of the screen during
 * React Router navigation transitions.
 */

import React, { useEffect, useState } from 'react';
import { useNavigation } from 'react-router-dom';
import './NavigationProgress.css';

export const NavigationProgress: React.FC = () => {
  const navigation = useNavigation();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (navigation.state === 'loading') {
      // Start progress animation
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev; // Cap at 90% until actually done
          return prev + 10;
        });
      }, 100);

      return () => clearInterval(interval);
    } else {
      // Complete the progress bar when navigation is done
      setProgress(100);
      const timeout = setTimeout(() => {
        setProgress(0);
      }, 200);

      return () => clearTimeout(timeout);
    }
  }, [navigation.state]);

  if (progress === 0) return null;

  return (
    <div
      className="navigation-progress-bar"
      role="progressbar"
      aria-label="Page loading"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: `${progress}%`,
      }}
    />
  );
};

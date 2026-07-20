import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './NotFound.css';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <div className="not-found-icon">
          <RocketLaunchIcon sx={{ fontSize: 'inherit' }} />
        </div>
        <h1 className="not-found-title">404</h1>
        <h2 className="not-found-subtitle">Lost in the Verse</h2>
        <p className="not-found-message">
          The coordinates you entered don't match any known location in our star charts.
        </p>
        <p className="not-found-hint">
          The page you're looking for might have been moved, deleted, or never existed.
        </p>

        <div className="not-found-actions">
          <button
            onClick={handleGoHome}
            className="not-found-button primary"
            aria-label="Navigate to dashboard"
          >
            Return to Dashboard
          </button>
          <button
            onClick={handleGoBack}
            className="not-found-button secondary"
            aria-label="Go back to previous page"
          >
            Go Back
          </button>
        </div>

        <div className="not-found-suggestions">
          <p className="not-found-suggestions-title">Popular destinations:</p>
          <div className="not-found-links">
            <Link to="/fleet" className="not-found-link">
              Fleet Management
            </Link>
            <Link to="/activities?tab=calendar" className="not-found-link">
              Tactical Calendar
            </Link>
            <Link to="/logistics" className="not-found-link">
              Logistics
            </Link>
            <Link to="/trading" className="not-found-link">
              Trading
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

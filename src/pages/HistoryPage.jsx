import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripAPI } from '../services/api';
import './HistoryPage.css';

function HistoryPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tripAPI.listTrips(50);
      setTrips(response.trips || []);
    } catch (err) {
      console.error('Error loading trip history:', err);
      setError('Failed to load trip history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const viewTrip = (trip) => {
    // Transform MongoDB trip data to match the expected format
    const tripResult = {
      trip_id: trip._id,
      total_distance_miles: trip.trip_plan.total_distance_miles,
      total_driving_hours: trip.trip_plan.total_driving_hours,
      estimated_total_hours: trip.trip_plan.estimated_total_hours,
      schedule: trip.trip_plan.schedule,
      daily_logs: trip.trip_plan.daily_logs,
      hos_compliance: trip.trip_plan.hos_compliance,
      summary: trip.trip_plan.summary,
      route_data: trip.trip_plan.route_data || {}
    };

    const formData = {
      currentLat: trip.current_location.lat,
      currentLon: trip.current_location.lon,
      currentAddress: trip.current_location.address || `${trip.current_location.lat}, ${trip.current_location.lon}`,
      pickupLat: trip.pickup_location.lat,
      pickupLon: trip.pickup_location.lon,
      pickupAddress: trip.pickup_location.address || `${trip.pickup_location.lat}, ${trip.pickup_location.lon}`,
      dropoffLat: trip.dropoff_location.lat,
      dropoffLon: trip.dropoff_location.lon,
      dropoffAddress: trip.dropoff_location.address || `${trip.dropoff_location.lat}, ${trip.dropoff_location.lon}`,
      driverName: trip.driver_info?.driver_name || 'N/A',
      carrierName: trip.driver_info?.carrier_name || 'N/A',
      vehicleNumber: trip.driver_info?.vehicle_number || 'N/A',
      mainOffice: trip.driver_info?.main_office || 'N/A',
      currentCycle: trip.current_cycle_used || 0
    };

    navigate('/results', { 
      state: { 
        tripResult, 
        formData 
      } 
    });
  };

  const deleteTrip = async (tripId) => {
    if (!window.confirm('Are you sure you want to delete this trip?')) {
      return;
    }

    try {
      await tripAPI.deleteTrip(tripId);
      // Remove from local state
      setTrips(trips.filter(t => t._id !== tripId));
    } catch (err) {
      console.error('Error deleting trip:', err);
      alert('Failed to delete trip. Please try again.');
    }
  };

  const clearAllHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all trip history? This cannot be undone.')) {
      return;
    }

    try {
      // Delete all trips one by one
      await Promise.all(trips.map(trip => tripAPI.deleteTrip(trip._id)));
      setTrips([]);
    } catch (err) {
      console.error('Error clearing history:', err);
      alert('Failed to clear all history. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="history-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading trip history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Error Loading History</h2>
          <p>{error}</p>
          <button onClick={loadTrips} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <div className="header-content">
          <h1>Trip History</h1>
          <p>View and manage your past trip plans</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/')} className="new-trip-btn">
            Calculate New Trip
          </button>
          {trips.length > 0 && (
            <button onClick={clearAllHistory} className="clear-btn">
              Clear All History
            </button>
          )}
        </div>
      </div>

      <div className="history-container">
        {trips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2>No Trip History</h2>
            <p>Your calculated trips will appear here</p>
            <button onClick={() => navigate('/')} className="empty-cta">
              Plan Your First Trip
            </button>
          </div>
        ) : (
          <div className="trips-grid">
            {trips.map((trip) => (
              <div key={trip._id} className="trip-card">
                <div className="trip-header">
                  <div className="trip-date">
                    {new Date(trip.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <button 
                    onClick={() => deleteTrip(trip._id)} 
                    className="delete-btn"
                    title="Delete trip"
                  >
                    ×
                  </button>
                </div>

                <div className="trip-details">
                  <div className="trip-route">
                    <div className="location-item">
                      <span className="location-label">From:</span>
                      <span className="location-text">
                        {trip.current_location.address || `${trip.current_location.lat.toFixed(4)}, ${trip.current_location.lon.toFixed(4)}`}
                      </span>
                    </div>
                    <div className="route-arrow">↓</div>
                    <div className="location-item">
                      <span className="location-label">Pickup:</span>
                      <span className="location-text">
                        {trip.pickup_location.address || `${trip.pickup_location.lat.toFixed(4)}, ${trip.pickup_location.lon.toFixed(4)}`}
                      </span>
                    </div>
                    <div className="route-arrow">↓</div>
                    <div className="location-item">
                      <span className="location-label">To:</span>
                      <span className="location-text">
                        {trip.dropoff_location.address || `${trip.dropoff_location.lat.toFixed(4)}, ${trip.dropoff_location.lon.toFixed(4)}`}
                      </span>
                    </div>
                  </div>

                  <div className="trip-summary">
                    <div className="summary-stat">
                      <span className="stat-label">Distance</span>
                      <span className="stat-value">{trip.trip_plan.total_distance_miles} mi</span>
                    </div>
                    <div className="summary-stat">
                      <span className="stat-label">Driving Time</span>
                      <span className="stat-value">{trip.trip_plan.total_driving_hours} hrs</span>
                    </div>
                    <div className="summary-stat">
                      <span className="stat-label">Total Time</span>
                      <span className="stat-value">{trip.trip_plan.estimated_total_hours} hrs</span>
                    </div>
                  </div>

                  <div className="trip-driver">
                    <strong>Driver:</strong> {trip.driver_info?.driver_name || 'N/A'}
                  </div>
                </div>

                <button onClick={() => viewTrip(trip)} className="view-btn">
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;

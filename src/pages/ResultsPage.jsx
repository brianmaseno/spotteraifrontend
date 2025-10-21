import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tripAPI } from '../services/api';
import './ResultsPage.css';

function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tripResult, formData } = location.state || {};
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!tripResult) {
      navigate('/');
      return;
    }
    // Trip is already saved to MongoDB by the backend
  }, [tripResult, navigate]);

  const downloadPDF = async () => {
    if (!tripResult?.trip_id) return;
    
    setDownloading(true);
    try {
      const response = await tripAPI.downloadELDPDF(tripResult.trip_id);
      
      // Create blob from response
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ELD_Logs_${tripResult.trip_id}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      let errorMessage = 'Failed to download PDF. ';
      
      if (err.response?.data) {
        try {
          // Try to parse error response if it's JSON
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const errorData = JSON.parse(reader.result);
              console.error('Server error:', errorData);
              alert(errorMessage + (errorData.error || 'Please try again.'));
            } catch {
              alert(errorMessage + 'Please try again.');
            }
          };
          reader.readAsText(err.response.data);
        } catch {
          alert(errorMessage + 'Please try again.');
        }
      } else {
        alert(errorMessage + 'Please check your connection and try again.');
      }
      
      console.error('Error downloading PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Initialize Azure Maps
  useEffect(() => {
    if (tripResult && formData && mapRef.current && window.atlas) {
      // Clear existing map
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.dispose();
        } catch {
          console.log('Map already disposed');
        }
      }

      // Get coordinates
      const currentLoc = [parseFloat(formData.currentLon), parseFloat(formData.currentLat)];
      const pickupLoc = [parseFloat(formData.pickupLon), parseFloat(formData.pickupLat)];
      const dropoffLoc = [parseFloat(formData.dropoffLon), parseFloat(formData.dropoffLat)];

      // Calculate bounding box for initial view
      const bounds = window.atlas.data.BoundingBox.fromLatLngs([
        [currentLoc[1], currentLoc[0]],
        [pickupLoc[1], pickupLoc[0]],
        [dropoffLoc[1], dropoffLoc[0]]
      ]);

      // Initialize map with camera focused on route
      const map = new window.atlas.Map(mapRef.current, {
        bounds: bounds,
        padding: 80,
        language: 'en-US',
        authOptions: {
          authType: 'subscriptionKey',
          subscriptionKey: import.meta.env.VITE_AZURE_MAPS_KEY
        }
      });

      mapInstanceRef.current = map;

      map.events.add('ready', async () => {
        // Add data source for route
        const dataSource = new window.atlas.source.DataSource();
        map.sources.add(dataSource);

        // Fetch real driving route from Azure Maps Route API
        const subscriptionKey = import.meta.env.VITE_AZURE_MAPS_KEY;
        const routeUrl = `https://atlas.microsoft.com/route/directions/json?api-version=1.0&subscription-key=${subscriptionKey}&query=${currentLoc[1]},${currentLoc[0]}:${pickupLoc[1]},${pickupLoc[0]}:${dropoffLoc[1]},${dropoffLoc[0]}`;

        try {
          const response = await fetch(routeUrl);
          const routeData = await response.json();

          if (routeData.routes && routeData.routes.length > 0) {
            // Extract route coordinates
            const routeCoordinates = [];
            routeData.routes[0].legs.forEach(leg => {
              leg.points.forEach(point => {
                routeCoordinates.push([point.longitude, point.latitude]);
              });
            });

            // Add the actual route line
            const routeLine = new window.atlas.data.LineString(routeCoordinates);
            dataSource.add(new window.atlas.data.Feature(routeLine));

            // Add route layer with gradient effect
            map.layers.add(new window.atlas.layer.LineLayer(dataSource, 'route-layer', {
              strokeColor: [
                'interpolate',
                ['linear'],
                ['line-progress'],
                0, '#121b45',
                0.5, '#1a2859',
                1, '#2563eb'
              ],
              strokeWidth: 6,
              lineGradient: true
            }));
          } else {
            // Fallback to straight line if route API fails
            const routeLine = new window.atlas.data.LineString([currentLoc, pickupLoc, dropoffLoc]);
            dataSource.add(new window.atlas.data.Feature(routeLine));

            map.layers.add(new window.atlas.layer.LineLayer(dataSource, null, {
              strokeColor: '#121b45',
              strokeWidth: 5
            }));
          }
        } catch (error) {
          console.error('Error fetching route:', error);
          // Fallback to straight line
          const routeLine = new window.atlas.data.LineString([currentLoc, pickupLoc, dropoffLoc]);
          dataSource.add(new window.atlas.data.Feature(routeLine));

          map.layers.add(new window.atlas.layer.LineLayer(dataSource, null, {
            strokeColor: '#121b45',
            strokeWidth: 5
          }));
        }

        // Add markers for locations
        // Add markers for locations
        dataSource.add([
          new window.atlas.data.Feature(new window.atlas.data.Point(currentLoc), {
            title: 'Current Location',
            icon: 'marker-blue'
          }),
          new window.atlas.data.Feature(new window.atlas.data.Point(pickupLoc), {
            title: 'Pickup Location',
            icon: 'marker-yellow'
          }),
          new window.atlas.data.Feature(new window.atlas.data.Point(dropoffLoc), {
            title: 'Dropoff Location',
            icon: 'marker-red'
          })
        ]);

        // Create route line - Removed duplicate (now handled above with real route)

        // Add route layer - Removed duplicate (now handled above)

        // Add symbol layer for markers
        map.layers.add(new window.atlas.layer.SymbolLayer(dataSource, null, {
          iconOptions: {
            allowOverlap: true,
            ignorePlacement: true
          },
          textOptions: {
            textField: ['get', 'title'],
            offset: [0, 1.5],
            size: 12
          }
        }));

        // Add rest stop markers from schedule
        const restStops = tripResult.schedule.filter(item => 
          item.duty_status === 'sleeper_berth' || item.activity === 'Fueling Stop'
        );

        restStops.forEach((stop) => {
          if (stop.location) {
            const stopPoint = new window.atlas.data.Point([stop.location.lon, stop.location.lat]);
            dataSource.add(new window.atlas.data.Feature(stopPoint, {
              title: stop.activity,
              icon: 'pin-round-blue'
            }));
          }
        });
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.dispose();
        } catch {
          console.log('Map cleanup - already disposed');
        }
        mapInstanceRef.current = null;
      }
    };
  }, [tripResult, formData]);

  if (!tripResult) {
    return null;
  }

  return (
    <div className="results-page">
      {/* Header with Actions */}
      <div className="results-header">
        <div className="header-content">
          <h1>Trip Plan Results</h1>
          <div className="header-actions">
            <button onClick={downloadPDF} className="download-btn" disabled={downloading}>
              {downloading ? (
                <>
                  <span className="spinner"></span>
                  Downloading...
                </>
              ) : (
                <>
                  Download ELD Logs
                </>
              )}
            </button>
            <button onClick={() => navigate('/')} className="new-trip-btn">
              Calculate New Trip
            </button>
            <button onClick={() => navigate('/history')} className="history-btn">
              View History
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Map + Details Side by Side */}
      <div className="results-layout">
        {/* Map Section - Left Half */}
        <div className="map-section">
          <div className="map-card">
            <h2>Route Map</h2>
            <div ref={mapRef} className="map-container"></div>
          </div>
        </div>

        {/* Details Section - Right Half */}
        <div className="details-section">
          {/* Trip Summary */}
          <div className="summary-card">
            <h2>Trip Summary</h2>
            <div className="summary-grid">
              <div className="summary-item">
                <div className="summary-icon"></div>
                <div className="summary-content">
                  <span className="label">Total Distance</span>
                  <span className="value">{tripResult.total_distance_miles} miles</span>
                </div>
              </div>
              <div className="summary-item">
                <div className="summary-icon"></div>
                <div className="summary-content">
                  <span className="label">Driving Time</span>
                  <span className="value">{tripResult.total_driving_hours} hours</span>
                </div>
              </div>
              <div className="summary-item">
                <div className="summary-icon"></div>
                <div className="summary-content">
                  <span className="label">Total Trip Time</span>
                  <span className="value">{tripResult.estimated_total_hours} hours</span>
                </div>
              </div>
              <div className="summary-item">
                <div className="summary-icon"></div>
                <div className="summary-content">
                  <span className="label">Rest Breaks</span>
                  <span className="value">{tripResult.summary.rest_breaks}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Hours Status (if available) */}
          {tripResult.weekly_hours && (
            <div className="weekly-hours-card">
              <h2>Weekly Hours of Service</h2>
              <div className="weekly-hours-content">
                <div className="hours-info">
                  <span className="hours-label">Mode:</span>
                  <span className="hours-value">{tripResult.weekly_hours.mode}</span>
                </div>
                <div className="hours-info">
                  <span className="hours-label">Hours Used:</span>
                  <span className="hours-value">{tripResult.weekly_hours.hours_used.toFixed(1)} hours</span>
                </div>
                <div className="hours-info">
                  <span className="hours-label">Remaining:</span>
                  <span className="hours-value available">{tripResult.weekly_hours.hours_remaining.toFixed(1)} hours</span>
                </div>
                {tripResult.weekly_hours.hours_after_trip !== undefined && (
                  <div className="hours-info">
                    <span className="hours-label">After Trip:</span>
                    <span className={`hours-value ${tripResult.weekly_hours.hours_after_trip < 5 ? 'warning' : ''}`}>
                      {tripResult.weekly_hours.hours_after_trip.toFixed(1)} hours
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HOS Compliance Status */}
          <div className={`compliance-card ${tripResult.hos_compliance.compliant ? 'compliant' : 'violation'}`}>
            <h2>HOS Compliance Status</h2>
            <div className="compliance-status">
              {tripResult.hos_compliance.compliant ? (
                <>
                  <span className="status-icon"></span>
                  <span>Trip is compliant with HOS regulations</span>
                </>
              ) : (
                <>
                  <span className="status-icon"></span>
                  <span>HOS violations detected</span>
                </>
              )}
            </div>
            {tripResult.hos_compliance.violations.length > 0 && (
              <ul className="violations-list">
                {tripResult.hos_compliance.violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Detailed Schedule */}
          <div className="schedule-card">
            <h2>Detailed Schedule</h2>
            <div className="schedule-list">
              {tripResult.schedule.map((item, index) => (
                <div key={index} className={`schedule-item ${item.duty_status}`}>
                  <div className="schedule-header">
                    <span className="schedule-time">
                      {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="schedule-duration">{item.duration_hours.toFixed(2)} hrs</span>
                    {item.split_sleeper_segment && (
                      <span className="split-sleeper-badge">
                        Split Sleeper {item.split_sleeper_segment}
                      </span>
                    )}
                  </div>
                  <div className="schedule-body">
                    <strong className="schedule-activity">{item.activity}</strong>
                    <p className="schedule-description">{item.description}</p>
                    {item.location_info && (
                      <div className="location-info">
                        <span className="location-icon">📍</span>
                        <span className="location-text">
                          {item.location_info.city && item.location_info.state 
                            ? `${item.location_info.city}, ${item.location_info.state}`
                            : item.location_info.state || 'Location available'}
                        </span>
                      </div>
                    )}
                    {item.distance_miles && (
                      <span className="schedule-distance">{item.distance_miles.toFixed(1)} miles</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Logs */}
          <div className="logs-card">
            <h2>Daily ELD Logs</h2>
            {tripResult.daily_logs.map((log, logIndex) => (
              <div key={logIndex} className="daily-log">
                <h3>
                  {new Date(log.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h3>
                <div className="log-summary">
                  <span className="log-miles">{log.total_miles.toFixed(1)} miles</span>
                </div>
                <div className="log-totals">
                  <div className="log-stat driving">
                    <span className="stat-label">Driving</span>
                    <span className="stat-value">{log.total_driving.toFixed(1)} hrs</span>
                  </div>
                  <div className="log-stat on-duty">
                    <span className="stat-label">On-Duty</span>
                    <span className="stat-value">{log.total_on_duty.toFixed(1)} hrs</span>
                  </div>
                  <div className="log-stat off-duty">
                    <span className="stat-label">Off-Duty</span>
                    <span className="stat-value">{log.total_off_duty.toFixed(1)} hrs</span>
                  </div>
                  <div className="log-stat sleeper">
                    <span className="stat-label">Sleeper</span>
                    <span className="stat-value">{log.total_sleeper.toFixed(1)} hrs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResultsPage;

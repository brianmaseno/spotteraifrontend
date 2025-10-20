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
      alert('Failed to download PDF. Please try again.');
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

      // Initialize map
      const map = new window.atlas.Map(mapRef.current, {
        center: currentLoc,
        zoom: 5,
        language: 'en-US',
        authOptions: {
          authType: 'subscriptionKey',
          subscriptionKey: import.meta.env.VITE_AZURE_MAPS_KEY
        }
      });

      mapInstanceRef.current = map;

      map.events.add('ready', () => {
        // Add data source for route
        const dataSource = new window.atlas.source.DataSource();
        map.sources.add(dataSource);

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

        // Create route line
        const routeLine = new window.atlas.data.LineString([currentLoc, pickupLoc, dropoffLoc]);
        dataSource.add(new window.atlas.data.Feature(routeLine));

        // Add route layer
        map.layers.add(new window.atlas.layer.LineLayer(dataSource, null, {
          strokeColor: '#2563eb',
          strokeWidth: 5
        }));

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

        // Fit map to show all markers
        const bounds = window.atlas.data.BoundingBox.fromData([currentLoc, pickupLoc, dropoffLoc]);
        map.setCamera({
          bounds: bounds,
          padding: 80
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
                  </div>
                  <div className="schedule-body">
                    <strong className="schedule-activity">{item.activity}</strong>
                    <p className="schedule-description">{item.description}</p>
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

import { useState, useEffect, useRef } from 'react';
import { tripAPI } from './services/api';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    currentLat: '',
    currentLon: '',
    pickupLat: '',
    pickupLon: '',
    dropoffLat: '',
    dropoffLon: '',
    cycleUsed: '',
    driverName: '',
    carrierName: '',
    mainOffice: '',
    vehicleNumber: '',
  });

  const [tripResult, setTripResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tripData = {
        current_location: {
          lat: parseFloat(formData.currentLat),
          lon: parseFloat(formData.currentLon)
        },
        pickup_location: {
          lat: parseFloat(formData.pickupLat),
          lon: parseFloat(formData.pickupLon)
        },
        dropoff_location: {
          lat: parseFloat(formData.dropoffLat),
          lon: parseFloat(formData.dropoffLon)
        },
        current_cycle_used: parseFloat(formData.cycleUsed),
        driver_name: formData.driverName,
        carrier_name: formData.carrierName,
        main_office: formData.mainOffice,
        vehicle_number: formData.vehicleNumber,
      };

      const result = await tripAPI.planTrip(tripData);
      setTripResult(result);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate trip plan');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!tripResult?.trip_id) return;
    
    try {
      const blob = await tripAPI.downloadELDPDF(tripResult.trip_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eld_logs_${tripResult.trip_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to download PDF');
      console.error('Error downloading PDF:', err);
    }
  };

  // Initialize Azure Maps when trip result is available
  useEffect(() => {
    if (tripResult && mapRef.current && window.atlas) {
      // Clear existing map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.dispose();
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
          strokeWidth: 4
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

        restStops.forEach((stop, index) => {
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
        mapInstanceRef.current.dispose();
      }
    };
  }, [tripResult, formData]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>ELD Trip Planner</h1>
        <p>Hours of Service Compliant Trip Planning</p>
      </header>

      <div className="content-grid">
        {/* Input Form */}
        <div className="form-section">
          <h2>Trip Details</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <h3>Current Location</h3>
              <input
                type="number"
                step="any"
                name="currentLat"
                placeholder="Latitude"
                value={formData.currentLat}
                onChange={handleInputChange}
                required
              />
              <input
                type="number"
                step="any"
                name="currentLon"
                placeholder="Longitude"
                value={formData.currentLon}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <h3>Pickup Location</h3>
              <input
                type="number"
                step="any"
                name="pickupLat"
                placeholder="Latitude"
                value={formData.pickupLat}
                onChange={handleInputChange}
                required
              />
              <input
                type="number"
                step="any"
                name="pickupLon"
                placeholder="Longitude"
                value={formData.pickupLon}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <h3>Dropoff Location</h3>
              <input
                type="number"
                step="any"
                name="dropoffLat"
                placeholder="Latitude"
                value={formData.dropoffLat}
                onChange={handleInputChange}
                required
              />
              <input
                type="number"
                step="any"
                name="dropoffLon"
                placeholder="Longitude"
                value={formData.dropoffLon}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <h3>Current Cycle Used (Hours)</h3>
              <input
                type="number"
                step="0.1"
                name="cycleUsed"
                placeholder="0-70 hours"
                value={formData.cycleUsed}
                onChange={handleInputChange}
                min="0"
                max="70"
                required
              />
            </div>

            <div className="form-group">
              <h3>Driver Information</h3>
              <input
                type="text"
                name="driverName"
                placeholder="Driver Name"
                value={formData.driverName}
                onChange={handleInputChange}
                required
              />
              <input
                type="text"
                name="carrierName"
                placeholder="Carrier Name"
                value={formData.carrierName}
                onChange={handleInputChange}
                required
              />
              <input
                type="text"
                name="mainOffice"
                placeholder="Main Office Address"
                value={formData.mainOffice}
                onChange={handleInputChange}
                required
              />
              <input
                type="text"
                name="vehicleNumber"
                placeholder="Vehicle Number"
                value={formData.vehicleNumber}
                onChange={handleInputChange}
                required
              />
            </div>

            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? 'Calculating...' : 'Calculate Trip Plan'}
            </button>
          </form>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {tripResult && (
          <div className="results-section">
            <h2>Trip Plan Results</h2>

            {/* Route Map */}
            <div className="map-card">
              <h3>Route Map</h3>
              <div ref={mapRef} className="map-container"></div>
            </div>

            {/* Summary */}
            <div className="summary-card">
              <h3>Summary</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Total Distance:</span>
                  <span className="value">{tripResult.total_distance_miles} mi</span>
                </div>
                <div className="summary-item">
                  <span className="label">Driving Time:</span>
                  <span className="value">{tripResult.total_driving_hours} hrs</span>
                </div>
                <div className="summary-item">
                  <span className="label">Total Trip Time:</span>
                  <span className="value">{tripResult.estimated_total_hours} hrs</span>
                </div>
                <div className="summary-item">
                  <span className="label">Rest Breaks:</span>
                  <span className="value">{tripResult.summary.rest_breaks}</span>
                </div>
              </div>
            </div>

            {/* HOS Compliance */}
            <div className={`compliance-card ${tripResult.hos_compliance.compliant ? 'compliant' : 'violation'}`}>
              <h3>HOS Compliance Status</h3>
              <p className="compliance-status">
                {tripResult.hos_compliance.compliant 
                  ? 'Trip is compliant with HOS regulations'
                  : 'HOS violations detected'}
              </p>
              {tripResult.hos_compliance.violations.length > 0 && (
                <ul>
                  {tripResult.hos_compliance.violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Schedule */}
            <div className="schedule-card">
              <h3>Detailed Schedule</h3>
              <div className="schedule-list">
                {tripResult.schedule.map((item, index) => (
                  <div key={index} className={`schedule-item ${item.duty_status}`}>
                    <div className="schedule-time">
                      {new Date(item.start_time).toLocaleTimeString()}
                    </div>
                    <div className="schedule-activity">
                      <strong>{item.activity}</strong>
                      <span>{item.description}</span>
                      <span className="duration">{item.duration_hours.toFixed(2)} hrs</span>
                      {item.distance_miles && (
                        <span className="distance">{item.distance_miles.toFixed(1)} mi</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Logs */}
            <div className="logs-card">
              <h3>Daily ELD Logs</h3>
              {tripResult.daily_logs.map((log, logIndex) => (
                <div key={logIndex} className="daily-log">
                  <h4>
                    {new Date(log.date).toLocaleDateString()} - {log.total_miles.toFixed(1)} miles
                  </h4>
                  <div className="log-totals">
                    <span>Driving: {log.total_driving.toFixed(1)} hrs</span>
                    <span>On-Duty: {log.total_on_duty.toFixed(1)} hrs</span>
                    <span>Off-Duty: {log.total_off_duty.toFixed(1)} hrs</span>
                    <span>Sleeper: {log.total_sleeper.toFixed(1)} hrs</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Download PDF Button */}
            <button onClick={downloadPDF} className="download-button">
              Download ELD Logs PDF
            </button>
          </div>
        )}
      </div>

      <footer className="app-footer">
        <p>Following FMCSA 70hrs/8days regulations for property-carrying drivers</p>
      </footer>
    </div>
  );
}

export default App;

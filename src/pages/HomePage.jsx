import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripAPI } from '../services/api';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentLat: '',
    currentLon: '',
    currentAddress: '',
    pickupLat: '',
    pickupLon: '',
    pickupAddress: '',
    dropoffLat: '',
    dropoffLon: '',
    dropoffAddress: '',
    cycleUsed: '',
    driverName: '',
    carrierName: '',
    mainOffice: '',
    vehicleNumber: '',
    // New HOS compliance fields
    weeklyMode: '70/8',
    useSplitSleeper: false,
    useAdverseConditions: false,
    useAirMileException: false,
  });

  const [searchResults, setSearchResults] = useState({
    current: [],
    pickup: [],
    dropoff: []
  });
  
  const [showSuggestions, setShowSuggestions] = useState({
    current: false,
    pickup: false,
    dropoff: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const searchTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const searchLocation = async (query, locationType) => {
    if (!query || query.length < 3) {
      setSearchResults(prev => ({ ...prev, [locationType]: [] }));
      setShowSuggestions(prev => ({ ...prev, [locationType]: false }));
      return;
    }

    clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const subscriptionKey = import.meta.env.VITE_AZURE_MAPS_KEY;
        const url = `https://atlas.microsoft.com/search/address/json?api-version=1.0&subscription-key=${subscriptionKey}&query=${encodeURIComponent(query)}&limit=5`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          setSearchResults(prev => ({ ...prev, [locationType]: data.results }));
          setShowSuggestions(prev => ({ ...prev, [locationType]: true }));
        }
      } catch (error) {
        console.error('Error searching location:', error);
      }
    }, 300);
  };

  const handleLocationSearch = (e, locationType) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      [`${locationType}Address`]: value
    }));
    searchLocation(value, locationType);
  };

  const selectLocation = (result, locationType) => {
    const { position, address } = result;
    
    setFormData(prev => ({
      ...prev,
      [`${locationType}Lat`]: position.lat,
      [`${locationType}Lon`]: position.lon,
      [`${locationType}Address`]: address.freeformAddress || `${position.lat}, ${position.lon}`
    }));
    
    setShowSuggestions(prev => ({ ...prev, [locationType]: false }));
    setSearchResults(prev => ({ ...prev, [locationType]: [] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tripData = {
        current_location: {
          lat: parseFloat(formData.currentLat),
          lon: parseFloat(formData.currentLon),
          address: formData.currentAddress
        },
        pickup_location: {
          lat: parseFloat(formData.pickupLat),
          lon: parseFloat(formData.pickupLon),
          address: formData.pickupAddress
        },
        dropoff_location: {
          lat: parseFloat(formData.dropoffLat),
          lon: parseFloat(formData.dropoffLon),
          address: formData.dropoffAddress
        },
        current_cycle_used: parseFloat(formData.cycleUsed),
        driver_name: formData.driverName,
        carrier_name: formData.carrierName,
        main_office: formData.mainOffice,
        vehicle_number: formData.vehicleNumber,
        // New HOS compliance fields
        weekly_mode: formData.weeklyMode,
        use_split_sleeper: formData.useSplitSleeper,
        use_adverse_conditions: formData.useAdverseConditions,
        use_air_mile_exception: formData.useAirMileException,
      };

      const result = await tripAPI.planTrip(tripData);
      
      // Navigate to results page with trip data
      navigate('/results', { 
        state: { 
          tripResult: result, 
          formData: formData 
        } 
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate trip plan');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="hero-overlay">
          <div className="hero-content">
            <h1>ELD Trip Planner</h1>
            <p>Hours of Service Compliant Trip Planning for Professional Drivers</p>
          </div>
        </div>
      </div>

      <div className="form-container">
        <div className="form-card">
          <div className="form-card-header">
            <div>
              <h2>Plan Your Trip</h2>
              <p className="form-subtitle">Enter your trip details to get HOS-compliant route planning</p>
            </div>
            <button 
              type="button"
              onClick={() => navigate('/history')} 
              className="history-link-btn"
            >
              View History
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Current Location */}
            <div className="form-section">
              <h3>Current Location</h3>
              <div className="form-group location-search">
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    name="currentAddress"
                    placeholder="Search for address or place..."
                    value={formData.currentAddress}
                    onChange={(e) => handleLocationSearch(e, 'current')}
                    autoComplete="off"
                    required
                  />
                  {showSuggestions.current && searchResults.current.length > 0 && (
                    <div className="suggestions-dropdown">
                      {searchResults.current.map((result, index) => (
                        <div
                          key={index}
                          className="suggestion-item"
                          onClick={() => selectLocation(result, 'current')}
                        >
                          <div className="suggestion-title">{result.address.freeformAddress}</div>
                          <div className="suggestion-subtitle">
                            {result.address.country} • {result.position.lat.toFixed(4)}, {result.position.lon.toFixed(4)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="coordinates-display">
                  {formData.currentLat && formData.currentLon && (
                    <small>{formData.currentLat.toFixed(4)}, {formData.currentLon.toFixed(4)}</small>
                  )}
                </div>
              </div>
            </div>

            {/* Pickup Location */}
            <div className="form-section">
              <h3>Pickup Location</h3>
              <div className="form-group location-search">
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    name="pickupAddress"
                    placeholder="Search for address or place..."
                    value={formData.pickupAddress}
                    onChange={(e) => handleLocationSearch(e, 'pickup')}
                    autoComplete="off"
                    required
                  />
                  {showSuggestions.pickup && searchResults.pickup.length > 0 && (
                    <div className="suggestions-dropdown">
                      {searchResults.pickup.map((result, index) => (
                        <div
                          key={index}
                          className="suggestion-item"
                          onClick={() => selectLocation(result, 'pickup')}
                        >
                          <div className="suggestion-title">{result.address.freeformAddress}</div>
                          <div className="suggestion-subtitle">
                            {result.address.country} • {result.position.lat.toFixed(4)}, {result.position.lon.toFixed(4)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="coordinates-display">
                  {formData.pickupLat && formData.pickupLon && (
                    <small>{formData.pickupLat.toFixed(4)}, {formData.pickupLon.toFixed(4)}</small>
                  )}
                </div>
              </div>
            </div>

            {/* Dropoff Location */}
            <div className="form-section">
              <h3>Dropoff Location</h3>
              <div className="form-group location-search">
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    name="dropoffAddress"
                    placeholder="Search for address or place..."
                    value={formData.dropoffAddress}
                    onChange={(e) => handleLocationSearch(e, 'dropoff')}
                    autoComplete="off"
                    required
                  />
                  {showSuggestions.dropoff && searchResults.dropoff.length > 0 && (
                    <div className="suggestions-dropdown">
                      {searchResults.dropoff.map((result, index) => (
                        <div
                          key={index}
                          className="suggestion-item"
                          onClick={() => selectLocation(result, 'dropoff')}
                        >
                          <div className="suggestion-title">{result.address.freeformAddress}</div>
                          <div className="suggestion-subtitle">
                            {result.address.country} • {result.position.lat.toFixed(4)}, {result.position.lon.toFixed(4)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="coordinates-display">
                  {formData.dropoffLat && formData.dropoffLon && (
                    <small>{formData.dropoffLat.toFixed(4)}, {formData.dropoffLon.toFixed(4)}</small>
                  )}
                </div>
              </div>
            </div>

            {/* Driver Info */}
            <div className="form-section">
              <h3>Driver Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Driver Name</label>
                  <input
                    type="text"
                    name="driverName"
                    placeholder="John Doe"
                    value={formData.driverName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Current Cycle Used (Hours)</label>
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
              </div>
            </div>

            {/* Company Info */}
            <div className="form-section">
              <h3>Company Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Carrier Name</label>
                  <input
                    type="text"
                    name="carrierName"
                    placeholder="ABC Logistics"
                    value={formData.carrierName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Vehicle Number</label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    placeholder="TRK-001"
                    value={formData.vehicleNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Main Office Address</label>
                <input
                  type="text"
                  name="mainOffice"
                  placeholder="123 Main St, City, State"
                  value={formData.mainOffice}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            {/* HOS Compliance Options - NEW */}
            <div className="form-section hos-options">
              <h3>Hours of Service Options</h3>
              
              <div className="form-group">
                <label>Weekly Hours Limit</label>
                <select
                  name="weeklyMode"
                  value={formData.weeklyMode}
                  onChange={handleInputChange}
                  className="select-input"
                >
                  <option value="70/8">70 hours in 8 days (Standard)</option>
                  <option value="60/7">60 hours in 7 days</option>
                </select>
                <small className="field-help">Select your company's operating schedule</small>
              </div>

              <div className="hos-checkboxes">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="useSplitSleeper"
                      checked={formData.useSplitSleeper}
                      onChange={handleInputChange}
                    />
                    <span className="checkbox-text">
                      <strong>Use Split Sleeper Berth</strong>
                      <small>Divide 10-hour rest into 7+3 or 8+2 hours without counting against 14-hour window</small>
                    </span>
                  </label>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="useAdverseConditions"
                      checked={formData.useAdverseConditions}
                      onChange={handleInputChange}
                    />
                    <span className="checkbox-text">
                      <strong>Adverse Driving Conditions</strong>
                      <small>Adds 2 hours of driving time for unexpected weather, accidents, or road conditions</small>
                    </span>
                  </label>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="useAirMileException"
                      checked={formData.useAirMileException}
                      onChange={handleInputChange}
                    />
                    <span className="checkbox-text">
                      <strong>150 Air-Mile Short-Haul Exception</strong>
                      <small>For drivers operating within 150 air-miles of their work reporting location</small>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Calculating Trip...
                </>
              ) : (
                <>
                  Calculate Trip Plan →
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default HomePage;

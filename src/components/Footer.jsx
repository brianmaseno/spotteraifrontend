import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>ELD Trip Planner</h3>
          <p>Professional Hours of Service compliant trip planning</p>
        </div>
        
        <div className="footer-section">
          <p>HOS Compliance | FMCSA ELD Logs | Route Optimization</p>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p>&copy; {new Date().getFullYear()} ELD Trip Planner. All rights reserved.</p>
          <p className="compliance-text">
            Following FMCSA 49 CFR Part 395 regulations
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

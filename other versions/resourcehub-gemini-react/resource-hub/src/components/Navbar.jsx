import React from 'react';
import { Search, Bell, Settings, User } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar glass-panel">
      <div className="navbar-container">
        <div className="navbar-brand">
          <span className="brand-highlight">IIT</span>
          <span className="brand-text">H Resource Hub</span>
        </div>
        
        <div className="navbar-links">
          <a href="#" className="nav-link">Dashboard</a>
          <a href="#" className="nav-link active">Courses</a>
          <a href="#" className="nav-link">Resources</a>
          <a href="#" className="nav-link">Library</a>
          <a href="#" className="nav-link">Community</a>
        </div>

        <div className="navbar-actions">
          <div className="user-profile">
            <div className="avatar">
              <User size={16} />
            </div>
            <span className="username">Student</span>
          </div>
          <button className="icon-btn"><Bell size={18} /></button>
          <button className="icon-btn"><Settings size={18} /></button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

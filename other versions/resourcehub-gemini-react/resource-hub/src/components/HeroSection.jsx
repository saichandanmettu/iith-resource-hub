import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { DEPARTMENTS, CATEGORIES } from '../dummyData';
import './HeroSection.css';

const HeroSection = ({ onFilterChange }) => {
  const [activeDept, setActiveDept] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');

  const handleDeptChange = (dept) => {
    setActiveDept(dept);
    onFilterChange(dept, activeCategory);
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    onFilterChange(activeDept, category);
  };

  return (
    <div className="hero-section animate-fade-in">
      <div className="hero-content">
        <h1 className="hero-title">
          <span className="text-gradient">IIT-H</span> RESOURCE HUB
        </h1>
        <p className="hero-subtitle">
          Explore Academic Resources, Notes, & Materials.
        </p>

        <div className="search-container glass-panel">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search for courses, materials, professors..."
          />
          <button className="filter-btn">
            <SlidersHorizontal size={18} />
          </button>
        </div>

        <div className="filters-container">
          <div className="dept-filters">
            {DEPARTMENTS.map(dept => (
              <button 
                key={dept} 
                className={`filter-pill ${activeDept === dept ? 'active' : ''}`}
                onClick={() => handleDeptChange(dept)}
              >
                {dept}
              </button>
            ))}
          </div>
          
          <div className="category-filters">
            {CATEGORIES.map(cat => (
              <button 
                key={cat} 
                className={`text-filter ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;

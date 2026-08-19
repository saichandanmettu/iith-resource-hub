import React, { useState, useMemo } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import ResourceGrid from './components/ResourceGrid';
import { DUMMY_RESOURCES } from './dummyData';
import './App.css';

function App() {
  const [activeDept, setActiveDept] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');

  const handleFilterChange = (dept, category) => {
    setActiveDept(dept);
    setActiveCategory(category);
  };

  const filteredResources = useMemo(() => {
    return DUMMY_RESOURCES.filter((resource) => {
      const matchDept = activeDept === 'All' || resource.department === activeDept;
      
      // Map 'Quizzes', 'Notes', 'Assignments' from filter bar to 'Quiz', 'Notes', 'Assignment' in data
      // For simplicity, we just check if it includes or starts with it.
      let matchCategory = false;
      if (activeCategory === 'All') {
        matchCategory = true;
      } else if (activeCategory === 'Quizzes' && resource.category === 'Quiz') {
        matchCategory = true;
      } else if (activeCategory === 'Assignments' && resource.category === 'Assignment') {
        matchCategory = true;
      } else if (activeCategory === 'Notes' && resource.category === 'Notes') {
        matchCategory = true;
      } else if (activeCategory === 'Projects' && resource.category === 'Project') {
        matchCategory = true;
      }

      return matchDept && matchCategory;
    });
  }, [activeDept, activeCategory]);

  return (
    <div className="app-container">
      <Navbar />
      
      <main>
        <HeroSection onFilterChange={handleFilterChange} />
        
        <div className="content-wrapper">
          <ResourceGrid resources={filteredResources} />
        </div>
      </main>

      <footer className="footer">
        <p>© 2026 IIT-H Resource Hub. Powered by Modern Web Tech.</p>
      </footer>
    </div>
  );
}

export default App;

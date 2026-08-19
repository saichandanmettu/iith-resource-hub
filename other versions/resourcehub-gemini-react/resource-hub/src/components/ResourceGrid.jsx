import React from 'react';
import ResourceCard from './ResourceCard';
import './ResourceGrid.css';

const ResourceGrid = ({ resources }) => {
  if (resources.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <p>No resources found for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="resource-grid">
      {resources.map((resource, index) => (
        <div key={resource.id} style={{ animationDelay: `${index * 0.1}s` }} className="animate-fade-in-up">
          <ResourceCard resource={resource} />
        </div>
      ))}
    </div>
  );
};

export default ResourceGrid;

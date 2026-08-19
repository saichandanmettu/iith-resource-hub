import React from 'react';
import { FileText, Download } from 'lucide-react';
import './ResourceCard.css';

const ResourceCard = ({ resource }) => {
  const { title, category, department, professor, date, link } = resource;

  const getCategoryColor = (cat) => {
    switch (cat.toLowerCase()) {
      case 'notes': return 'category-notes';
      case 'assignment': return 'category-assignment';
      case 'quiz': return 'category-quiz';
      default: return '';
    }
  };

  return (
    <div className="resource-card glass-panel animate-fade-in">
      <div className="card-header">
        <span className={`category-badge ${getCategoryColor(category)}`}>
          {category}
        </span>
        <span className="dept-badge">{department}</span>
      </div>
      
      <div className="card-body">
        <h3 className="card-title">{title}</h3>
        <p className="card-professor">{professor}</p>
      </div>

      <div className="card-footer">
        <div className="card-actions">
          <a href={link} className="action-btn">
            <FileText size={16} /> PDF
          </a>
          <a href={link} className="action-btn">
            <Download size={16} />
          </a>
        </div>
        <span className="card-date">Last Updated: {date}</span>
      </div>
    </div>
  );
};

export default ResourceCard;

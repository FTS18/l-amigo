import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { FriendProfile } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DifficultyChartProps {
  profile: FriendProfile;
  isDarkMode?: boolean;
}

export const DifficultyChart: React.FC<DifficultyChartProps> = ({ profile, isDarkMode }) => {
  const { problemsSolved } = profile;
  
  const data = {
    labels: ['Easy', 'Medium', 'Hard'],
    datasets: [
      {
        data: [problemsSolved.easy, problemsSolved.medium, problemsSolved.hard],
        backgroundColor: [
          'rgba(0, 184, 163, 0.8)',  // Green for Easy
          'rgba(255, 161, 22, 0.8)',  // Orange for Medium
          'rgba(255, 55, 95, 0.8)',   // Red for Hard
        ],
        borderColor: [
          'rgba(0, 184, 163, 1)',
          'rgba(255, 161, 22, 1)',
          'rgba(255, 55, 95, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: isDarkMode ? '#e0e0e0' : '#333',
          padding: 10,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = problemsSolved.easy + problemsSolved.medium + problemsSolved.hard;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
  };

  return (
    <div className="difficulty-chart">
      <Doughnut data={data} options={options} />
    </div>
  );
};

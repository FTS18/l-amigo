import React from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { FriendProfile } from '../types';

interface DifficultyChartProps {
  profile: FriendProfile;
  isDarkMode?: boolean;
}

export const DifficultyChart: React.FC<DifficultyChartProps> = ({ profile, isDarkMode }) => {
  const { problemsSolved } = profile;
  
  const data = [
    { name: 'Easy', value: problemsSolved.easy, color: 'rgba(0, 184, 163, 0.8)' },
    { name: 'Medium', value: problemsSolved.medium, color: 'rgba(255, 161, 22, 0.8)' },
    { name: 'Hard', value: problemsSolved.hard, color: 'rgba(255, 55, 95, 0.8)' },
  ];

  const total = problemsSolved.easy + problemsSolved.medium + problemsSolved.hard;

  const renderLabel = (entry: any) => {
    const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
    return `${entry.name}: ${entry.value} (${percentage}%)`;
  };

  return (
    <div className="difficulty-chart" style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color.replace('0.8', '1')} strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
              color: isDarkMode ? '#e0e0e0' : '#333',
              border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`
            }}
            formatter={(value: any, name?: string) => {
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return [`${value} (${percentage}%)`, name || ''];
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            wrapperStyle={{
              color: isDarkMode ? '#e0e0e0' : '#333',
              fontSize: '11px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

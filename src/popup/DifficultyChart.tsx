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
    { name: 'Easy', value: problemsSolved.easy, color: 'var(--color-easy)' },
    { name: 'Medium', value: problemsSolved.medium, color: 'var(--color-medium)' },
    { name: 'Hard', value: problemsSolved.hard, color: 'var(--color-hard)' },
  ];

  const total = problemsSolved.easy + problemsSolved.medium + problemsSolved.hard;

  const renderLabel = (entry: any) => {
    const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
    return `${entry.name}: ${entry.value} (${percentage}%)`;
  };

  return (
    <div className="difficulty-chart" style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
              <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--bg-primary)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)'
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
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-sm)'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

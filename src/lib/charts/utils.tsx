import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { supabase } from '../supabase/client';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    title: {
      display: true,
      text: 'Response Statistics',
    },
  },
};

export async function getResponseStats() {
  try {
    const { data: responses, error } = await supabase
      .from('responses')
      .select(`
        question_id,
        questions (
          question_text
        ),
        count
      `)
      .group('question_id, questions.question_text')
      .count();

    if (error) throw error;

    const labels = responses?.map((r: any) => r.questions.question_text) || [];
    const data = responses?.map((r: any) => r.count) || [];

    return {
      labels,
      datasets: [
        {
          label: 'Number of Responses',
          data,
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
        },
      ],
    };
  } catch (error) {
    console.error('Error fetching response stats:', error);
    return {
      labels: [],
      datasets: [
        {
          label: 'Number of Responses',
          data: [],
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
        },
      ],
    };
  }
}

export function ResponseChart({ data }: { data: any }) {
  return <Bar options={chartOptions} data={data} />;
} 
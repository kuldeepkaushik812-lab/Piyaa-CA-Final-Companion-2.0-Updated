import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { StudyLog } from '../store';

interface WeeklyHeatmapProps {
  studyLogs: StudyLog[];
}

export const WeeklyHeatmap: React.FC<WeeklyHeatmapProps> = ({ studyLogs }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !studyLogs) return;

    // Process data to get hours per day
    const hoursPerDay = new Map<string, number>();
    studyLogs.forEach(log => {
      const current = hoursPerDay.get(log.date) || 0;
      hoursPerDay.set(log.date, current + log.hours);
    });

    // Generate last 12 weeks of dates
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 12 * 7);

    const dates: Date[] = d3.timeDays(startDate, d3.timeDay.offset(endDate, 1));
    const data = dates.map(date => {
      const dateStr = d3.timeFormat('%Y-%m-%d')(date);
      return {
        date,
        dateStr,
        value: hoursPerDay.get(dateStr) || 0
      };
    });

    const cellSize = 14;
    const cellMargin = 2;
    const width = 12 * 7 * (cellSize + cellMargin) + 50; // Approximated
    const height = 7 * (cellSize + cellMargin) + 30;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`)
       .attr('preserveAspectRatio', 'xMinYMin meet')
       .style('width', '100%')
       .style('height', 'auto');

    const g = svg.append("g")
      .attr("transform", "translate(40, 20)");

    // Define color scale
    const colorScale = d3.scaleThreshold<number, string>()
      .domain([0.1, 2, 4, 6, 8])
      .range(['#1e293b', '#064e3b', '#059669', '#10b981', '#34d399', '#6ee7b7']);

    // Draw days (Y axis)
    const days = ['Mon', 'Wed', 'Fri'];
    g.selectAll('text.day')
      .data([1, 3, 5])
      .enter()
      .append('text')
      .text(d => days[d === 1 ? 0 : d === 3 ? 1 : 2])
      .attr('x', -25)
      .attr('y', d => d * (cellSize + cellMargin) + 10)
      .style('font-size', '10px')
      .style('fill', '#94a3b8')
      .style('font-family', 'monospace');

    // Draw months (X axis)
    const months = d3.timeMonths(startDate, d3.timeMonth.offset(endDate, 1));
    g.selectAll('text.month')
      .data(months)
      .enter()
      .append('text')
      .text(d => d3.timeFormat('%b')(d))
      .attr('x', d => {
        const diffWeeks = d3.timeWeek.count(d3.timeWeek.floor(startDate), d3.timeWeek.floor(d));
        return diffWeeks * (cellSize + cellMargin);
      })
      .attr('y', -8)
      .style('font-size', '10px')
      .style('fill', '#94a3b8')
      .style('font-family', 'monospace');

    // Draw cells
    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('background', '#0f172a')
      .style('color', '#fff')
      .style('padding', '6px 10px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('border', '1px solid #334155')
      .style('z-index', 1000)
      .style('box-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1)');

    g.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('x', d => d3.timeWeek.count(d3.timeWeek.floor(startDate), d.date) * (cellSize + cellMargin))
      .attr('y', d => d.date.getDay() * (cellSize + cellMargin))
      .attr('rx', 2)
      .attr('ry', 2)
      .style('fill', d => colorScale(d.value))
      .style('stroke', '#0f172a')
      .style('stroke-width', 1)
      .on('mouseover', (event, d) => {
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`<strong>${d.dateStr}</strong><br/>${d.value > 0 ? d.value.toFixed(1) + ' hrs' : 'No study logged'}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(500).style('opacity', 0);
      });

    return () => {
      d3.selectAll('.d3-tooltip').remove();
    };

  }, [studyLogs]);

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden flex items-center justify-center p-2">
      <svg ref={svgRef} className="max-w-full" />
    </div>
  );
};

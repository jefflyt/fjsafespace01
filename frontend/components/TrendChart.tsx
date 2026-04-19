"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DataPoint {
  date: string;
  [key: string]: string | number;
}

interface TrendChartProps {
  title?: string;
  description?: string;
  data: DataPoint[];
  lines?: { key: string; label: string; color: string }[];
  emptyMessage?: string;
}

const DEFAULT_LINES = [
  { key: "value", label: "Value", color: "#8700E3" },
];

export function TrendChart({
  title = "Trend Analysis",
  description = "Metric values over time",
  data,
  lines = DEFAULT_LINES,
  emptyMessage = "No trend data available.",
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis
                dataKey="date"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              />
              <Legend fontSize={12} />
              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  stroke={line.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }}
                  name={line.label}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

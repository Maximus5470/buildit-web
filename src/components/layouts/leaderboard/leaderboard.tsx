"use client";

import { Crown, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getLeaderboardData,
  type LeaderboardEntry,
} from "@/actions/leaderboard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Podium Component
function Podium({ top3 }: { top3: LeaderboardEntry[] }) {
  const [first, second, third] = [top3[0], top3[1], top3[2]];

  const RenderPodiumItem = ({
    entry,
    position,
  }: {
    entry?: LeaderboardEntry;
    position: 1 | 2 | 3;
  }) => {
    if (!entry) return <div className="w-32" />; // spacer

    let ringColor = "";
    let badgeColor = "";
    let height = "";
    let icon = null;

    if (position === 1) {
      ringColor = "ring-yellow-400";
      badgeColor = "bg-yellow-400 text-black";
      height = "mt-0 scale-110";
      icon = (
        <Crown className="size-6 text-yellow-400 mb-2" fill="currentColor" />
      );
    } else if (position === 2) {
      ringColor = "ring-slate-300";
      badgeColor = "bg-slate-300 text-black";
      height = "mt-8";
    } else if (position === 3) {
      ringColor = "ring-amber-600";
      badgeColor = "bg-amber-600 text-white";
      height = "mt-12";
    }

    return (
      <div className={cn("flex flex-col items-center", height)}>
        {position === 1 && icon}
        <div className="relative">
          <Avatar
            className={cn(
              "size-20 border-4 border-background ring-4",
              ringColor,
            )}
          >
            <AvatarImage
              src={entry.user.image || undefined}
              alt={entry.user.name || "User"}
            />
            <AvatarFallback>{entry.user.name?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-bold",
              badgeColor,
            )}
          >
            #{position}
          </div>
        </div>
        <div className="mt-4 text-center">
          <h3 className="font-bold text-lg leading-tight">{entry.user.name}</h3>
          <p className="text-primary font-bold text-sm">{entry.score} pts</p>
          <p className="text-muted-foreground text-xs">{entry.time}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-end justify-center gap-4 sm:gap-12 py-8 bg-muted/20 rounded-xl border border-border/50">
      <RenderPodiumItem entry={second} position={2} />
      <RenderPodiumItem entry={first} position={1} />
      <RenderPodiumItem entry={third} position={3} />
    </div>
  );
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboardData().then((res) => {
      setData(res);
      setLoading(false);
    });
  }, []);

  // Compute Stats of top 3 users
  const top3 = data.slice(0, 3);

  const avgScore =
    top3.length > 0
      ? Math.round(
          top3.reduce((acc, curr) => acc + curr.score, 0) / top3.length,
        )
      : 0;
  const highestScore =
    top3.length > 0 ? Math.max(...top3.map((d) => d.score)) : 0;
  const highestScoreCount = top3.filter((d) => d.score === highestScore).length;

  // Passing grade? Let's assume > 60% of max score?
  // Let's just mock a calculation:
  const passRate =
    top3.length > 0
      ? Math.round(
          (top3.filter((d) => d.score >= 50).length / top3.length) * 100,
        )
      : 0;

  if (loading)
    return <div className="p-10 text-center">Loading leaderboard...</div>;

  return (
    <div className="space-y-8 p-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Global Leaderboard
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm">
            <Badge
              variant="secondary"
              className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0"
            >
              Hard
            </Badge>
            <span>• {data.length} Participants</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground font-medium">
              Average Score
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold">{avgScore}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground font-medium">
              Highest Score
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold">{highestScore}</span>
              <span className="text-sm text-muted-foreground">/100</span>
              <span className="text-xs text-muted-foreground">
                ({highestScoreCount} Students)
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground font-medium">
              Pass Rate
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold">{passRate}%</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-950/20 border-blue-900/50">
          <CardContent className="p-6">
            <p className="text-sm text-blue-400 font-medium">Your Rank</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-blue-100">--</span>
              <span className="text-xs text-blue-300">Top --%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Podium */}
      <div className="flex flex-col items-center">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-8">
          Top Performers
        </h2>
        <Podium top3={top3} />
        <div className="mt-[-2rem] z-10 hidden sm:block">
          {/* Decorative WINNER text or graphic behind could go here */}
        </div>
      </div>

      {/* List */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8">
              <Search className="mr-2 h-4 w-4" /> Filter
            </Button>
            <Button variant="ghost" size="sm" className="h-8">
              Anonymize
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Showing 1-{data.length} of {data.length}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[80px]">Rank</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Language</TableHead>
                <TableHead className="w-[30%]">Test Cases</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.userId} className="group">
                  <TableCell className="font-medium text-muted-foreground">
                    {row.rank}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={row.user.image || undefined} />
                        <AvatarFallback>
                          {row.user.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm group-hover:text-primary transition-colors">
                        {row.user.name}
                      </span>
                      {row.userId === "me" && (
                        <Badge
                          variant="secondary"
                          className="ml-2 text-[10px] h-5"
                        >
                          You
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {/* Simple icon logic */}
                      {row.language === "C++" && (
                        <span className="text-blue-400 font-mono">C++</span>
                      )}
                      {row.language === "Python" && (
                        <span className="text-yellow-400 font-mono">{}</span>
                      )}
                      {row.language === "JS" && (
                        <span className="text-yellow-300 font-mono">JS</span>
                      )}
                      {!["C++", "Python", "JS"].includes(row.language) && (
                        <span className="font-mono">{row.language}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground w-12 text-right">
                        {row.testCases}
                      </div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            row.passRate === 100
                              ? "bg-green-500"
                              : row.passRate > 50
                                ? "bg-blue-500"
                                : "bg-yellow-500",
                          )}
                          style={{ width: `${row.passRate}%` }}
                        />
                      </div>
                      <div
                        className={cn(
                          "text-xs font-bold w-10",
                          row.passRate === 100
                            ? "text-green-500"
                            : "text-blue-500",
                        )}
                      >
                        {Math.round(row.passRate)}%
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {row.time}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {row.score}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer "Me" Row (Mocked visibility for now) */}
      {/* In a real app, we check if current user is in list but outside viewport or pagination */}
    </div>
  );
}

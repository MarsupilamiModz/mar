"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitSnakeScore, getSnakeLeaderboard } from "@/actions/snake";

const GRID = 20;
const TICK_MS = 120;
const REQUIRED_CLICKS = 10;
const MAX_CLICK_GAP_MS = 450;
const SEQUENCE_TIMEOUT_MS = 2500;

type Point = { x: number; y: number };

type LeaderboardEntry = { username: string; score: number; createdAt: Date };

export function SnakeEasterEgg() {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const [open, setOpen] = useState(false);
  const clickTimesRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }] as Point[],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 15, y: 10 },
    running: false,
  });

  useEffect(() => {
    const onEmptyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, textarea, select, [role='button'], canvas")) return;
      if (target.closest("[data-snake-trigger]")) return;

      const now = Date.now();
      let times = clickTimesRef.current.filter((t) => now - t < SEQUENCE_TIMEOUT_MS);
      const last = times[times.length - 1];
      if (last != null && now - last > MAX_CLICK_GAP_MS) {
        times = [];
      }
      times.push(now);
      clickTimesRef.current = times;

      if (times.length >= REQUIRED_CLICKS) {
        clickTimesRef.current = [];
        setOpen(true);
      }
    };
    document.addEventListener("click", onEmptyClick);
    return () => document.removeEventListener("click", onEmptyClick);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const rows = await getSnakeLeaderboard(5);
    setLeaderboard(rows);
  }, []);

  useEffect(() => {
    if (open) loadLeaderboard();
  }, [open, loadLeaderboard]);

  const spawnFood = useCallback((snake: Point[]) => {
    let food: Point;
    do {
      food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
    return food;
  }, []);

  const resetGame = useCallback(() => {
    stateRef.current = {
      snake: [{ x: 10, y: 10 }],
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: { x: 15, y: 10 },
      running: true,
    };
    setScore(0);
    setGameOver(false);
  }, []);

  useEffect(() => {
    if (!open || gameOver) return;

    resetGame();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const map: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
      };
      const nd = map[e.key];
      if (!nd) return;
      e.preventDefault();
      const opposite = s.dir.x + nd.x === 0 && s.dir.y + nd.y === 0;
      if (!opposite) s.nextDir = nd;
    };
    window.addEventListener("keydown", onKey);

    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!s.running) return;
      s.dir = s.nextDir;
      const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };

      if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
        s.running = false;
        setGameOver(true);
        return;
      }
      if (s.snake.some((p) => p.x === head.x && p.y === head.y)) {
        s.running = false;
        setGameOver(true);
        return;
      }

      s.snake.unshift(head);
      if (head.x === s.food.x && head.y === s.food.y) {
        s.food = spawnFood(s.snake);
        setScore((sc) => sc + 10);
      } else {
        s.snake.pop();
      }

      const cell = canvas.width / GRID;
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(168,85,247,0.15)";
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(canvas.width, i * cell);
        ctx.stroke();
      }

      ctx.shadowBlur = 8;
      ctx.shadowColor = "#a855f7";
      ctx.fillStyle = "#a855f7";
      s.snake.forEach((p, i) => {
        ctx.globalAlpha = 1 - i * 0.03;
        ctx.fillRect(p.x * cell + 1, p.y * cell + 1, cell - 2, cell - 2);
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#3b82f6";
      ctx.shadowColor = "#3b82f6";
      ctx.fillRect(s.food.x * cell + 2, s.food.y * cell + 2, cell - 4, cell - 4);
      ctx.shadowBlur = 0;
    }, TICK_MS);

    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, gameOver, resetGame, spawnFood]);

  const handleGameOver = async () => {
    const result = await submitSnakeScore(score, locale);
    if (result.success && result.data.redirectPath) {
      router.push(result.data.redirectPath);
    }
    setOpen(false);
    setGameOver(false);
    loadLeaderboard();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md p-4" data-snake-trigger>
      <div className="glass w-full max-w-lg rounded-2xl border border-neon-purple/30 p-6 shadow-[0_0_60px_-10px_rgba(168,85,247,0.4)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gradient">Neon Snake</h2>
            <p className="text-xs text-muted-foreground">Score: {score}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <canvas ref={canvasRef} width={400} height={400} className="mx-auto w-full max-w-[400px] rounded-lg border border-border/50" />

        {gameOver && (
          <div className="mt-4 space-y-3 text-center">
            <p className="text-neon-purple font-semibold">Game Over — Score: {score}</p>
            <Button variant="neon" className="w-full" onClick={() => void handleGameOver()}>
              Continue exploring
            </Button>
          </div>
        )}

        {!gameOver && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Arrow keys or WASD · Eat blue orbs · Avoid walls
          </p>
        )}

        {leaderboard.length > 0 && (
          <div className="mt-4 border-t border-border/30 pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Leaderboard</p>
            <ul className="space-y-1 text-xs">
              {leaderboard.map((row, i) => (
                <li key={i} className="flex justify-between">
                  <span>{row.username}</span>
                  <span className="text-neon-purple">{row.score}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

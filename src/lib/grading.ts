export type GradingStrategy =
  | "linear"
  | "difficulty_based"
  | "count_based"
  | "standard_20_40_50";
export type Difficulty = "easy" | "medium" | "hard";

export type GradingConfig = {
  marks?: number;
  easy?: number;
  medium?: number;
  hard?: number;
  enablePartialPoints?: boolean;
  rules?: {
    count: number;
    marks: number;
  }[];
};

export interface GradingInput {
  strategy: GradingStrategy | string;
  config: GradingConfig;
  passedQuestionIds: string[];
  questionDifficulties?: Record<string, Difficulty>;
  questionScores?: Record<string, number>; // questionId -> percentage passed (0.0 to 1.0)
}

/**
 * Calculate the grading score based on the selected strategy and configuration.
 * Supports partial grading when questionScores is provided.
 */
export function calculateGradingScore(input: GradingInput): number {
  const {
    strategy,
    config,
    passedQuestionIds,
    questionDifficulties,
    questionScores,
  } = input;
  let score = 0;

  // Partial grading flag - if questionScores is provided, use partial scoring
  const allowPartial =
    config?.enablePartialPoints !== false && questionScores !== undefined;

  if (strategy === "linear") {
    // Linear: Score = (Number of passed questions) * (Marks per question)
    // Partial: Score = Sum(percentage * Marks per question)
    const marksPerQuestion = config?.marks || 0;

    if (allowPartial && questionScores) {
      // Iterate over all questions we have a score for
      for (const [_qId, percentage] of Object.entries(questionScores)) {
        score += percentage * marksPerQuestion;
      }
    } else {
      score = passedQuestionIds.length * marksPerQuestion;
    }
  } else if (strategy === "difficulty_based") {
    // Difficulty Based: Sum of marks of passed questions based on their difficulty
    const difficultyMarks = {
      easy: config?.easy || 0,
      medium: config?.medium || 0,
      hard: config?.hard || 0,
    };

    if (allowPartial && questionScores && questionDifficulties) {
      for (const [qId, percentage] of Object.entries(questionScores)) {
        const difficulty = questionDifficulties?.[qId];
        if (difficulty) {
          score += percentage * (difficultyMarks[difficulty] || 0);
        }
      }
    } else {
      for (const qId of passedQuestionIds) {
        const difficulty = questionDifficulties?.[qId];
        if (difficulty) {
          score += difficultyMarks[difficulty] || 0;
        }
      }
    }
  } else if (strategy === "count_based") {
    // Count Based: Threshold system
    // This strategy intrinsically depends on "Count of Completed Questions".
    // Partial points don't map well to "Count".
    // We will stick to the binary definition of "Passed" for the count.
    const rules = (config?.rules || []) as {
      count: number;
      marks: number;
    }[];
    // Sort rules by count descending to find the highest threshold met
    rules.sort((a, b) => b.count - a.count);

    const passedCount = passedQuestionIds.length;
    const matchedRule = rules.find((r) => passedCount >= r.count);
    if (matchedRule) {
      score = matchedRule.marks;
    }
  } else if (strategy === "standard_20_40_50") {
    // Standard scoring: easy=20, medium=40, hard=50
    const difficultyMarks = {
      easy: 20,
      medium: 40,
      hard: 50,
    };

    if (allowPartial && questionScores && questionDifficulties) {
      for (const [qId, percentage] of Object.entries(questionScores)) {
        const difficulty = questionDifficulties?.[qId];
        if (difficulty) {
          score += percentage * (difficultyMarks[difficulty] || 0);
        }
      }
    } else {
      for (const qId of passedQuestionIds) {
        const difficulty = questionDifficulties?.[qId];
        if (difficulty) {
          score += difficultyMarks[difficulty] || 0;
        }
      }
    }
  } else {
    // Legacy or unknown strategy
    console.warn(`Unknown grading strategy: ${strategy}`);
    score = 0;
  }

  // Round to 2 decimal places for cleanliness
  return Math.round(score * 100) / 100;
}

export type GradingStrategy = "linear" | "difficulty_based" | "count_based";
export type Difficulty = "easy" | "medium" | "hard";

export interface GradingInput {
  strategy: GradingStrategy | string;
  config: any;
  passedQuestionIds: string[];
  questionDifficulties?: Record<string, Difficulty>;
  questionScores?: Record<string, number>; // questionId -> percentage passed (0.0 to 1.0)
}

export function calculateGradingScore(input: GradingInput): number {
  const {
    strategy,
    config,
    passedQuestionIds,
    questionDifficulties,
    questionScores,
  } = input;
  let score = 0;

  // Partial grading flag - default to false if not specified, but user implied they want it.
  // Actually, checking if questionScores is provided is a good signal to use it,
  // but let's respect the config if it exists.
  // If config.enablePartialPoints is undefined, we assume FALSE to preserve legacy behavior?
  // User said "Partial grading based on testcases passed isn't working... I want to work with all the strategies".
  // So I will default to TRUE if questionScores is provided.
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
  } else {
    // Legacy or unknown
    console.warn(`Unknown grading strategy: ${strategy}`);
    score = 0;
  }

  // Ensure score isn't floating point weirdness if possible, but floors/ceils might be unwanted.
  // Let's keep 2 decimal places? Or just return as is?
  // User didn't specify, but existing was integer.
  // Let's assume float is fine, but maybe round to 2 decimals for cleanliness.
  return Math.round(score * 100) / 100;
}

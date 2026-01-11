"use server";

import db from "@/db";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  user: {
    name: string | null;
    image: string | null;
    username: string | null;
  };
  score: number;
  time: string; // Formatted time of last submission or total duration
  formattedDate: string;
  language: string; // dominant or last used
  testCases: string; // e.g. "48/50" or percentage (mocked if data not available)
  passRate: number; // 0-100
};

export async function getLeaderboardData() {
  // Fetch all submissions with user data
  const allSubmissions = await db.query.submissions.findMany({
    with: {
      user: true,
    },
  });

  // Fetch problems to get test case counts
  const allProblems = await db.query.problems.findMany({
    with: {
      testCases: true,
    },
  });

  const problemTestCaseCounts = new Map<string, number>();
  for (const p of allProblems) {
    // Count non-hidden test cases? Or all? Usually score is based on ALL.
    // Let's assume all.
    problemTestCaseCounts.set(p.id, p.testCases.length);
  }

  // map Map<UserId, Map<ProblemId, BestSubmission>>
  const userBestSubmissions = new Map<
    string,
    Map<string, (typeof allSubmissions)[0]>
  >();

  for (const sub of allSubmissions) {
    if (!sub.userId) continue;

    const uid = sub.userId;
    if (!uid) continue;

    if (!userBestSubmissions.has(uid)) {
      userBestSubmissions.set(uid, new Map());
    }

    const userProblems = userBestSubmissions.get(uid);
    if (!userProblems) continue;
    const existing = userProblems.get(sub.problemId);

    // Logic: maximize Score. If Score equal, minimize CreatedAt (earlier is better).
    // Note: If I solve it today with 100, and tomorrow with 100. My "best" is today's.
    // If I have 50 today, and 80 tomorrow. My "best" is 80 (tomorrow).

    // Calculate score based on status (accepted = 100, others = 0)
    const currentScore = sub.status === "accepted" ? 100 : 0;
    const existingScore = existing && existing.status === "accepted" ? 100 : 0;

    let shouldReplace = false;

    if (currentScore > existingScore) {
      shouldReplace = true;
    } else if (currentScore === existingScore) {
      // If scores are equal, prefer the EARLIER one (timestamp)
      // because that represents when they achieved that score.
      if (
        existing &&
        sub.createdAt &&
        existing.createdAt &&
        sub.createdAt < existing.createdAt
      ) {
        shouldReplace = true;
      } else if (!existing) {
        shouldReplace = true;
      }
    }

    if (shouldReplace) {
      userProblems.set(sub.problemId, sub);
    }
  }

  // Now aggregate per user
  const leaderboard: {
    userId: string;
    totalScore: number;
    lastActive: Date;
    user: (typeof allSubmissions)[0]["user"];
    language: string;
    totalTests: number;
    passedTests: number;
  }[] = [];

  for (const [userId, problemsMap] of userBestSubmissions.entries()) {
    let totalScore = 0;
    let lastActive = new Date(0); // Epoch
    let userObj: (typeof allSubmissions)[0]["user"] | null = null;
    let totalTests = 0;
    let passedTests = 0;
    const languages = new Map<string, number>();

    // For test cases visualization, we'll try to guess based on score?
    // Or just use the data if we had it. The table schema has 'answerData', maybe we can peek?
    // But for now, let's just assume score / 10 is 'tests passed' if max is 100.
    // Let's mock the "test cases" count based on score for visual flair.

    for (const [problemId, sub] of problemsMap.entries()) {
      userObj = sub.user;
      // Calculate score based on status
      const score = sub.status === "accepted" ? 100 : 0;
      totalScore += score;

      if (sub.createdAt && sub.createdAt > lastActive) {
        lastActive = sub.createdAt;
      }

      // Track language usage
      const lang = sub.language || "unknown";
      languages.set(lang, (languages.get(lang) || 0) + 1);

      // Calc tests
      const pTestCount = problemTestCaseCounts.get(problemId) || 0;
      if (pTestCount > 0) {
        totalTests += pTestCount;
        // Approximate passed based on score %
        passedTests += Math.round((score / 100) * pTestCount);
      }
    }

    // Find most used language
    let topLang = "Unknown";
    let maxCount = 0;
    for (const [lang, count] of languages.entries()) {
      if (count > maxCount) {
        maxCount = count;
        topLang = lang;
      }
    }

    // Capitalize Lang
    topLang = topLang.charAt(0).toUpperCase() + topLang.slice(1);
    if (topLang === "Cpp") topLang = "C++";
    if (topLang === "Javascript") topLang = "JS";
    if (topLang === "Typescript") topLang = "TS";
    if (topLang === "Python") topLang = "Python";

    // Skip entries without a valid user object
    if (!userObj) continue;

    leaderboard.push({
      userId,
      totalScore,
      lastActive,
      user: userObj,
      language: topLang,
      totalTests: totalTests, // Mock total tests
      passedTests: passedTests, // Mock passed tests roughly prop to score
    });
  }

  // Sort Leaderboard
  // 1. Total Score DESC
  // 2. Last Active ASC (Earlier submission wins tie)

  leaderboard.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return a.lastActive.getTime() - b.lastActive.getTime();
  });

  // Assign Ranks and format
  return leaderboard.map((entry, index) => {
    return {
      rank: index + 1,
      userId: entry.userId,
      user: {
        //FIXME: type
        name: entry.user?.name || "Anonymous",
        image: entry.user?.image || null,
        username: entry.user?.username || null,
      },
      score: entry.totalScore,
      time: entry.lastActive.toLocaleDateString(), // simplified
      formattedDate: entry.lastActive.toISOString(),
      language: entry.language,
      testCases: `${entry.passedTests}/${entry.totalTests}`,
      passRate:
        entry.totalTests > 0 ? (entry.passedTests / entry.totalTests) * 100 : 0,
    };
  });
}

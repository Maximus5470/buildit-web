export function getGreeting(): string {
  const now = new Date();
  const hour = now.getHours();
  const _month = now.getMonth(); // 0-11
  const day = now.getDay(); // 0-6 (Sun-Sat)

  // Time-based
  let _timeGreeting = "Good morning";
  if (hour >= 12 && hour < 17) {
    _timeGreeting = "Good afternoon";
  } else if (hour >= 17) {
    _timeGreeting = "Good evening";
  }

  // Season/Month checks (Northern Hemisphere)
  // Winter: Dec, Jan, Feb (11, 0, 1)
  // Spring: Mar, Apr, May (2, 3, 4)
  // Summer: Jun, Jul, Aug (5, 6, 7)
  // Autumn: Sep, Oct, Nov (8, 9, 10)

  // You can add specific festival logic here if needed,
  // e.g., if (month === 11 && day === 25) return "Merry Christmas";

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const currentDay = dayNames[day];

  // Randomize a bit for variety?
  // or keep it standard: "Good evening, Happy Monday!"
  return `Happy ${currentDay}`;
}

export function getSeason(): string {
  const month = new Date().getMonth();
  if (month === 11 || month <= 1) return "Winter";
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  return "Autumn";
}

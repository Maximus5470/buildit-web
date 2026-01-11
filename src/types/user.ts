export interface User {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  role: "student" | "instructor" | "admin";
  branch: string;
  semester: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
}

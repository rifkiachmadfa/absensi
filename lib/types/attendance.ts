export type AttendanceCheckInResponse =
  | {
      type: "SUCCESS";
      student: { name: string; nisn: string; className: string };
      time: string;
      status: string;
    }
  | {
      type: "ALREADY_CHECKED_IN";
      student: { name: string; className: string };
      time: string;
      status: string;
    }
  | { type: "STUDENT_INACTIVE"; student: { name: string } }
  | { type: "STUDENT_NOT_FOUND"; message?: string };
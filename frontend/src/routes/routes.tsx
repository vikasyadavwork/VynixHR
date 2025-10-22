import { createBrowserRouter, Navigate } from "react-router-dom";
import { Login, Workspace } from "@/hr/App";
import { Dashboard } from "@/hr/Dashboard";
import { Employees } from "@/hr/Employees";
import { Attendance } from "@/hr/Attendance";
import { Leaves } from "@/hr/Leaves";
import { Recruitment } from "@/hr/Recruitment";
import { Assistant } from "@/hr/Assistant";
import { Announcements } from "@/hr/Announcements";
import { Settings } from "@/hr/Settings";
import { Tasks } from "@/hr/Tasks";

export const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  {
    element: <Workspace />,
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/employees", element: <Employees /> },
      { path: "/attendance", element: <Attendance /> },
      { path: "/leaves", element: <Leaves /> },
      { path: "/recruitment", element: <Recruitment /> },
      { path: "/assistant", element: <Assistant /> },
      { path: "/announcements", element: <Announcements /> },
      { path: "/settings", element: <Settings /> },
      { path: "/tasks", element: <Tasks /> },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);

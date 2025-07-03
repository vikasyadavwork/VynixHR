import { useEffect, useState } from "react";
import axios from "axios";
import { useAuthStore } from "@/stores/auth-store";
import { FaUsers, FaChartLine, FaBriefcase } from "react-icons/fa";

export const DashboardHomePage = () => {
  const [username, setUsername] = useState<string | null>(null);
  const { token } = useAuthStore();

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/v1/users", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const user = response.data.find((user: any) => user.id === parseInt(token));
        setUsername(user?.username || "User");
      } catch (error) {
        console.error("Error fetching user details:", error);
      }
    };

    fetchUserDetails();
  }, [token]);

  const handleShowAllEmployees = () => {
    console.log("Show all employee data clicked!");
    // Add logic to navigate to or display employee data
  };

  const handleManageHRAccounts = () => {
    console.log("Manage HR accounts clicked!");
    // Add logic to navigate to or display HR account management
  };

  const handleAnalytics = () => {
    console.log("Analytics clicked!");
    // Add logic to navigate to or display analytics
  };

  return (
    <section className="min-h-screen bg-[url('https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')] bg-cover bg-center bg-no-repeat relative">
      {/* Overlay for gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-purple-900 to-gray-900 opacity-80" />

      {/* Content container */}
      <div className="relative z-10 p-6 text-white flex flex-col items-center justify-center min-h-screen">
        <h1 className="font-bold text-center text-3xl mb-8 text-blue-400 drop-shadow-lg">
          Welcome, {username || "Loading..."}!
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
          {/* Card 1: Show All Employees */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-700 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Show All Employees</h2>
              <FaUsers className="text-3xl" />
            </div>
            <p className="mt-4 text-sm">
              View and manage all employee data, including personal and professional details.
            </p>
            <button
              className="mt-6 w-full bg-white text-blue-700 font-semibold py-2 rounded-md hover:bg-gray-100 transition duration-150"
              onClick={handleShowAllEmployees}
            >
              View Employees
            </button>
          </div>

          {/* Card 2: Manage HR Accounts */}
          <div className="bg-gradient-to-r from-green-500 to-green-700 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Manage HR Accounts</h2>
              <FaBriefcase className="text-3xl" />
            </div>
            <p className="mt-4 text-sm">
              Manage HR accounts, including payroll, attendance, and other administrative tasks.
            </p>
            <button
              className="mt-6 w-full bg-white text-green-700 font-semibold py-2 rounded-md hover:bg-gray-100 transition duration-150"
              onClick={handleManageHRAccounts}
            >
              Manage Accounts
            </button>
          </div>

          {/* Card 3: Analytics */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-700 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Analytics</h2>
              <FaChartLine className="text-3xl" />
            </div>
            <p className="mt-4 text-sm">
              Analyze employee performance, attendance trends, and other key metrics.
            </p>
            <button
              className="mt-6 w-full bg-white text-purple-700 font-semibold py-2 rounded-md hover:bg-gray-100 transition duration-150"
              onClick={handleAnalytics}
            >
              View Analytics
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
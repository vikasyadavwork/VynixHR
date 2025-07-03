import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { Link, useNavigate } from "react-router-dom";

export const Navbar = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 w-full bg-gradient-to-r from-blue-500 via-purple-400 to-gray-900 z-50 shadow-lg">
      <nav className="flex items-center h-20 cs-container px-6">
        <Link
          to="/"
          className="flex items-center font-extrabold text-4xl tracking-wide"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <img
            src="/EmPulseHR-logo.png"
            alt="EmPulseHR Logo"
            className="w-14 h-14 mr-3 transform scale-150"
            style={{ objectFit: "cover" }}
          />
        </Link>
        <Button
          className="font-medium text-white border-white hover:bg-white hover:text-gray-900 transition duration-150"
          size="sm"
          variant="outline"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </nav>
    </header>
  );
};
